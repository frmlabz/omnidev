import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { getEnabledAdapters } from "@omnidev-ai/adapters";
import {
	getActiveProfile,
	loadBaseConfig,
	patchAddCapabilitySource,
	patchAddMcp,
	patchAddToProfile,
	syncAgentConfiguration,
	readCapabilityIdFromPath,
	detectPinVersion,
	type McpConfig,
	type McpTransport,
} from "@omnidev-ai/core";
import { buildCommand, buildRouteMap } from "@stricli/core";

interface AddCapFlags {
	github?: string | undefined;
	local?: string | undefined;
	path?: string | undefined;
	pin?: boolean | undefined;
}

/**
 * Infer capability ID from source
 */
async function inferCapabilityId(source: string, sourceType: "github" | "local"): Promise<string> {
	if (sourceType === "local") {
		// For local sources, try to read from capability.toml or use directory name
		const localPath = source.startsWith("file://") ? source.slice(7) : source;
		const resolvedPath = resolve(localPath);
		const id = await readCapabilityIdFromPath(resolvedPath);
		if (id) {
			return id;
		}
		// Last resort: use basename
		return basename(resolvedPath);
	}

	// For GitHub sources: parse github:user/repo or github:user/repo/path
	// Use last path segment or repo name
	const parts = source.replace("github:", "").split("/");
	if (parts.length >= 2) {
		// If there's a path like user/repo/subdir/cap, use the last segment
		// Otherwise use the repo name
		return parts[parts.length - 1] ?? parts[1] ?? "capability";
	}
	return "capability";
}

/**
 * Run the add cap command
 */
export async function runAddCap(flags: AddCapFlags, name?: string): Promise<void> {
	try {
		// Check if omni.toml exists
		if (!existsSync("omni.toml")) {
			console.log("✗ No config file found");
			console.log("  Run: omnidev init");
			process.exit(1);
		}

		// Validate that exactly one source flag is provided
		if (!flags.github && !flags.local) {
			console.error("✗ No source specified");
			console.log("  Use --github or --local to specify the capability source");
			console.log("  Example: omnidev add cap --github expo/skills");
			console.log("  Example: omnidev add cap --local ./capabilities/my-cap");
			process.exit(1);
		}

		if (flags.github && flags.local) {
			console.error("✗ Cannot specify both --github and --local");
			console.log("  Use only one source flag");
			process.exit(1);
		}

		// Determine source type and build source string
		let source: string;
		let sourceType: "github" | "local";

		if (flags.local) {
			sourceType = "local";
			// Normalize local path to file:// URL
			const localPath = flags.local.startsWith("file://") ? flags.local.slice(7) : flags.local;
			source = `file://${localPath}`;

			// Validate local path exists
			if (!existsSync(localPath)) {
				console.error(`✗ Local path not found: ${localPath}`);
				process.exit(1);
			}
		} else if (flags.github) {
			sourceType = "github";
			// Validate github format
			if (!flags.github.includes("/")) {
				console.error("✗ Invalid GitHub repository format");
				console.log("  Expected format: user/repo");
				console.log("  Example: omnidev add cap --github expo/skills");
				process.exit(1);
			}
			source = `github:${flags.github}`;
		} else {
			// This shouldn't happen due to earlier validation, but satisfy TypeScript
			throw new Error("Unreachable: no source specified");
		}

		// Infer ID if not provided
		let capabilityId = name;
		if (!capabilityId) {
			// If a path is specified for GitHub source, use the last segment of the path
			if (flags.path && sourceType === "github") {
				const pathParts = flags.path.split("/").filter(Boolean);
				capabilityId = pathParts[pathParts.length - 1];
				if (!capabilityId) {
					capabilityId = "capability";
				}
			} else {
				const sourceValue = sourceType === "local" ? flags.local : flags.github;
				if (!sourceValue) {
					throw new Error("Unreachable: cannot infer capability ID");
				}
				capabilityId = await inferCapabilityId(sourceValue, sourceType);
			}
			console.log(`  Inferred capability ID: ${capabilityId}`);
		}

		// Load config to check for duplicates and get active profile
		const config = await loadBaseConfig();
		const activeProfile = (await getActiveProfile()) ?? "default";

		// Check if source already exists
		if (config.capabilities?.sources?.[capabilityId]) {
			console.error(`✗ Capability source "${capabilityId}" already exists`);
			console.log("  Use a different name or remove the existing source first");
			process.exit(1);
		}

		// Determine version for the source
		let version: string | undefined;
		if (sourceType === "github" && flags.pin) {
			// Detect version from repo (capability.toml or commit hash)
			console.log(`  Detecting version to pin...`);
			version = await detectPinVersion(source, flags.path);
			console.log(`  Detected version: ${version}`);
		}
		// Note: version defaults to "latest" in formatCapabilitySource if not specified

		// Create source config and patch the TOML file (preserves comments)
		if (sourceType === "github") {
			const sourceConfig: { source: string; version?: string; path?: string } = { source };
			if (version) {
				sourceConfig.version = version;
			}
			if (flags.path) {
				sourceConfig.path = flags.path;
			}
			await patchAddCapabilitySource(capabilityId, sourceConfig);
		} else {
			// Local sources don't have version
			await patchAddCapabilitySource(capabilityId, source);
		}

		// Add to active profile (also preserves comments)
		await patchAddToProfile(activeProfile, capabilityId);

		console.log(`✓ Added capability source: ${capabilityId}`);
		console.log(`  Source: ${source}`);
		if (version) {
			console.log(`  Version: ${version}`);
		} else if (sourceType === "github") {
			console.log(`  Version: latest`);
		}
		if (flags.path) {
			console.log(`  Path: ${flags.path}`);
		}
		console.log(`  Enabled in profile: ${activeProfile}`);
		console.log("");

		// Auto-sync
		const adapters = await getEnabledAdapters();
		await syncAgentConfiguration({ adapters });

		console.log("✓ Sync completed");
	} catch (error) {
		console.error("✗ Error adding capability:", error);
		process.exit(1);
	}
}

interface AddMcpFlags {
	transport?: string | undefined;
	url?: string | undefined;
	command?: string | undefined;
	args?: string | undefined;
	header?: string[] | undefined;
	env?: string[] | undefined;
}

/**
 * Run the add mcp command
 */
export async function runAddMcp(flags: AddMcpFlags, name: string): Promise<void> {
	try {
		// Check if omni.toml exists
		if (!existsSync("omni.toml")) {
			console.log("✗ No config file found");
			console.log("  Run: omnidev init");
			process.exit(1);
		}

		// Load config to check for duplicates and get active profile
		const config = await loadBaseConfig();
		const activeProfile = (await getActiveProfile()) ?? "default";

		// Check if MCP already exists
		if (config.mcps?.[name]) {
			console.error(`✗ MCP "${name}" already exists`);
			console.log("  Use a different name or remove the existing MCP first");
			process.exit(1);
		}

		const transport = (flags.transport ?? "stdio") as McpTransport;
		const mcpConfig: McpConfig = {};

		if (transport === "http" || transport === "sse") {
			// Remote server - URL is required
			if (!flags.url) {
				console.error("✗ --url is required for http/sse transport");
				console.log(
					"  Example: omnidev add mcp notion --transport http --url https://mcp.notion.com/mcp",
				);
				process.exit(1);
			}

			mcpConfig.transport = transport;
			mcpConfig.url = flags.url;

			// Parse headers
			if (flags.header && flags.header.length > 0) {
				mcpConfig.headers = {};
				for (const header of flags.header) {
					const colonIndex = header.indexOf(":");
					if (colonIndex === -1) {
						console.error(`✗ Invalid header format: ${header}`);
						console.log("  Expected format: Name: Value");
						process.exit(1);
					}
					const headerName = header.slice(0, colonIndex).trim();
					const headerValue = header.slice(colonIndex + 1).trim();
					mcpConfig.headers[headerName] = headerValue;
				}
			}
		} else {
			// stdio transport - command is required
			if (!flags.command) {
				console.error("✗ --command is required for stdio transport");
				console.log(
					"  Example: omnidev add mcp filesystem --command npx --args '-y @modelcontextprotocol/server-filesystem /path'",
				);
				process.exit(1);
			}

			mcpConfig.command = flags.command;
			if (flags.args) {
				// Split args on spaces, respecting quoted strings
				mcpConfig.args = parseArgs(flags.args);
			}

			// Parse env variables
			if (flags.env && flags.env.length > 0) {
				mcpConfig.env = {};
				for (const envVar of flags.env) {
					const eqIndex = envVar.indexOf("=");
					if (eqIndex === -1) {
						console.error(`✗ Invalid env format: ${envVar}`);
						console.log("  Expected format: KEY=value");
						process.exit(1);
					}
					const key = envVar.slice(0, eqIndex);
					const value = envVar.slice(eqIndex + 1);
					mcpConfig.env[key] = value;
				}
			}
		}

		// Add MCP config (preserves comments)
		await patchAddMcp(name, mcpConfig);

		// Add to active profile (also preserves comments)
		await patchAddToProfile(activeProfile, name);

		console.log(`✓ Added MCP: ${name}`);
		console.log(`  Transport: ${transport}`);
		if (mcpConfig.url) {
			console.log(`  URL: ${mcpConfig.url}`);
		}
		if (mcpConfig.command) {
			console.log(`  Command: ${mcpConfig.command}`);
			if (mcpConfig.args) {
				console.log(`  Args: ${mcpConfig.args.join(" ")}`);
			}
		}
		console.log(`  Enabled in profile: ${activeProfile}`);
		console.log("");

		// Auto-sync
		const adapters = await getEnabledAdapters();
		await syncAgentConfiguration({ adapters });

		console.log("✓ Sync completed");
	} catch (error) {
		console.error("✗ Error adding MCP:", error);
		process.exit(1);
	}
}

/**
 * Parse a string of arguments, respecting quoted strings
 */
function parseArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote = false;
	let quoteChar = "";

	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i];

		if ((char === '"' || char === "'") && !inQuote) {
			inQuote = true;
			quoteChar = char;
		} else if (char === quoteChar && inQuote) {
			inQuote = false;
			quoteChar = "";
		} else if (char === " " && !inQuote) {
			if (current) {
				args.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}

	if (current) {
		args.push(current);
	}

	return args;
}

async function runAddCapWrapper(
	flags: {
		github: string | undefined;
		local: string | undefined;
		path: string | undefined;
		pin: boolean | undefined;
	},
	name: string | undefined,
): Promise<void> {
	await runAddCap(
		{ github: flags.github, local: flags.local, path: flags.path, pin: flags.pin },
		name,
	);
}

const addCapCommand = buildCommand({
	docs: {
		brief: "Add a capability source from GitHub or local path",
		fullDescription: `Add a capability source from a GitHub repository or local path. The capability will be auto-enabled in the active profile.

GitHub source:
  omnidev add cap [name] --github user/repo [--path subdir] [--pin]

Local source:
  omnidev add cap [name] --local ./path/to/capability

By default, GitHub sources use version = "latest". Use --pin to detect and pin to the current version (from capability.toml) or commit hash.

If the capability name is omitted, it will be inferred from:
- For local sources: the ID in capability.toml or directory name
- For GitHub sources: the repository name or last path segment

Examples:
  omnidev add cap my-cap --github expo/skills              # Uses version = "latest"
  omnidev add cap --github expo/skills                     # Infers name as "skills"
  omnidev add cap --github expo/skills --pin               # Pins to detected version
  omnidev add cap --local ./capabilities/my-cap            # Infers name from capability.toml
  omnidev add cap custom-name --local ./capabilities/my-cap`,
	},
	parameters: {
		flags: {
			github: {
				kind: "parsed" as const,
				brief: "GitHub repository in user/repo format",
				parse: String,
				optional: true,
			},
			local: {
				kind: "parsed" as const,
				brief: "Local path to capability directory",
				parse: String,
				optional: true,
			},
			path: {
				kind: "parsed" as const,
				brief: "Subdirectory within the repo containing the capability (GitHub only)",
				parse: String,
				optional: true,
			},
			pin: {
				kind: "boolean" as const,
				brief: "Pin to detected version (git hash or capability.toml version)",
				optional: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Capability name (optional, will be inferred if omitted)",
					parse: String,
					optional: true,
				},
			],
		},
		aliases: {
			g: "github",
			l: "local",
			p: "path",
		},
	},
	func: runAddCapWrapper,
});

async function runAddMcpWrapper(
	flags: {
		transport: string | undefined;
		url: string | undefined;
		command: string | undefined;
		args: string | undefined;
		header: string[] | undefined;
		env: string[] | undefined;
	},
	name: string,
): Promise<void> {
	await runAddMcp(
		{
			transport: flags.transport,
			url: flags.url,
			command: flags.command,
			args: flags.args,
			header: flags.header,
			env: flags.env,
		},
		name,
	);
}

const addMcpCommand = buildCommand({
	docs: {
		brief: "Add an MCP server",
		fullDescription: `Add an MCP server to the configuration. Supports three transport types:

HTTP remote server:
  omnidev add mcp <name> --transport http --url <url> [--header "Header: value"]

SSE remote server (deprecated):
  omnidev add mcp <name> --transport sse --url <url> [--header "Header: value"]

Stdio local process (default):
  omnidev add mcp <name> --command <cmd> [--args "arg1 arg2"] [--env KEY=value]

Examples:
  omnidev add mcp notion --transport http --url https://mcp.notion.com/mcp
  omnidev add mcp secure-api --transport http --url https://api.example.com/mcp --header "Authorization: Bearer token"
  omnidev add mcp filesystem --command npx --args "-y @modelcontextprotocol/server-filesystem /path"
  omnidev add mcp database --command node --args "./servers/db.js" --env DB_URL=postgres://localhost`,
	},
	parameters: {
		flags: {
			transport: {
				kind: "parsed" as const,
				brief: "Transport type: stdio (default), http, or sse",
				parse: String,
				optional: true,
			},
			url: {
				kind: "parsed" as const,
				brief: "URL for http/sse transport",
				parse: String,
				optional: true,
			},
			command: {
				kind: "parsed" as const,
				brief: "Command to run for stdio transport",
				parse: String,
				optional: true,
			},
			args: {
				kind: "parsed" as const,
				brief: "Arguments for the command (space-separated, use quotes for args with spaces)",
				parse: String,
				optional: true,
			},
			header: {
				kind: "parsed" as const,
				brief: "HTTP header in 'Name: Value' format (repeatable)",
				parse: String,
				optional: true,
				variadic: true,
			},
			env: {
				kind: "parsed" as const,
				brief: "Environment variable in KEY=value format (repeatable)",
				parse: String,
				optional: true,
				variadic: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "MCP name",
					parse: String,
				},
			],
		},
		aliases: {
			t: "transport",
			u: "url",
			c: "command",
			a: "args",
			e: "env",
		},
	},
	func: runAddMcpWrapper,
});

export const addRoutes = buildRouteMap({
	routes: {
		cap: addCapCommand,
		mcp: addMcpCommand,
	},
	docs: {
		brief: "Add capabilities or MCP servers",
	},
});
