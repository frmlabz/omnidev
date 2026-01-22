import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { input } from "@inquirer/prompts";
import { getEnabledAdapters } from "@omnidev-ai/adapters";
import {
	disableCapability,
	discoverCapabilities,
	enableCapability,
	generateCapabilityToml,
	generateHooksTemplate,
	generateHookScript,
	generateRuleTemplate,
	generateSkillTemplate,
	getEnabledCapabilities,
	loadCapabilityConfig,
	loadLockFile,
	syncAgentConfiguration,
	checkForUpdates,
	loadBaseConfig,
} from "@omnidev-ai/core";
import { buildCommand, buildRouteMap } from "@stricli/core";
// Note: buildCommand and buildRouteMap are still used for the CLI commands in this file
import { isValidCapabilityId } from "../prompts/capability.js";

/**
 * Run the capability list command.
 */
export async function runCapabilityList(flags: { verbose?: boolean } = {}): Promise<void> {
	try {
		const enabledIds = await getEnabledCapabilities();
		const capabilityPaths = await discoverCapabilities();
		const lockFile = await loadLockFile();

		if (capabilityPaths.length === 0) {
			console.log("No capabilities found.");
			console.log("");
			console.log("To add capabilities, create directories in omni/capabilities/");
			console.log("Each capability must have a capability.toml file.");
			return;
		}

		// Check for updates if verbose
		let updates: Map<string, { hasUpdate: boolean; latestVersion: string }> | undefined;
		if (flags.verbose) {
			try {
				const config = await loadBaseConfig();
				const updateInfo = await checkForUpdates(config);
				updates = new Map(
					updateInfo.map((u) => [u.id, { hasUpdate: u.hasUpdate, latestVersion: u.latestVersion }]),
				);
			} catch {
				// Silently ignore update check failures
			}
		}

		console.log("Capabilities:");
		console.log("");

		for (const path of capabilityPaths) {
			try {
				const capConfig = await loadCapabilityConfig(path);
				const isEnabled = enabledIds.includes(capConfig.capability.id);
				const status = isEnabled ? "✓ enabled" : "✗ disabled";
				const { id, name, version } = capConfig.capability;

				// Get lock entry for additional info
				const lockEntry = lockFile.capabilities[id];

				// Check if update is available
				const updateInfo = updates?.get(id);
				let versionDisplay = version;
				if (updateInfo?.hasUpdate) {
					versionDisplay = `${version} → ${updateInfo.latestVersion} available`;
				}

				console.log(`  ${status}  ${name}`);
				console.log(`           ID: ${id}`);
				console.log(`           Version: ${versionDisplay}`);

				if (flags.verbose && lockEntry) {
					// Show source information
					console.log(`           Source: ${lockEntry.source}`);

					// Show version source if available
					if (lockEntry.version_source) {
						console.log(`           Version from: ${lockEntry.version_source}`);
					}

					// Show commit for git sources
					if (lockEntry.commit) {
						console.log(`           Commit: ${lockEntry.commit.substring(0, 7)}`);
					}

					// Show content hash for file sources
					if (lockEntry.content_hash) {
						console.log(`           Content hash: ${lockEntry.content_hash.substring(0, 12)}`);
					}

					// Show pinned version if specified
					if (lockEntry.pinned_version) {
						console.log(`           Pinned: ${lockEntry.pinned_version}`);
					}

					// Show last update
					if (lockEntry.updated_at) {
						const date = new Date(lockEntry.updated_at);
						console.log(`           Updated: ${date.toLocaleString()}`);
					}
				}

				console.log("");
			} catch (error) {
				console.error(`  ✗ Failed to load capability at ${path}:`, error);
				console.log("");
			}
		}
	} catch (error) {
		console.error("Error listing capabilities:", error);
		process.exit(1);
	}
}

/**
 * Run the capability enable command.
 */
export async function runCapabilityEnable(
	_flags: Record<string, never>,
	name: string,
): Promise<void> {
	try {
		// Check if capability exists
		const capabilityPaths = await discoverCapabilities();
		const capabilityExists = capabilityPaths.some(async (path) => {
			const config = await loadCapabilityConfig(path);
			return config.capability.id === name;
		});

		if (!capabilityExists) {
			console.error(`Error: Capability '${name}' not found`);
			console.log("");
			console.log("Run 'dev capability list' to see available capabilities");
			process.exit(1);
		}

		await enableCapability(name);
		console.log(`✓ Enabled capability: ${name}`);
		console.log("");

		// Auto-sync agent configuration with enabled adapters
		const adapters = await getEnabledAdapters();
		await syncAgentConfiguration({ adapters });
	} catch (error) {
		console.error("Error enabling capability:", error);
		process.exit(1);
	}
}

/**
 * Run the capability disable command.
 */
export async function runCapabilityDisable(
	_flags: Record<string, never>,
	name: string,
): Promise<void> {
	try {
		await disableCapability(name);
		console.log(`✓ Disabled capability: ${name}`);
		console.log("");

		// Auto-sync agent configuration with enabled adapters
		const adapters = await getEnabledAdapters();
		await syncAgentConfiguration({ adapters });
	} catch (error) {
		console.error("Error disabling capability:", error);
		process.exit(1);
	}
}

/**
 * Convert kebab-case to Title Case.
 */
function toTitleCase(kebabCase: string): string {
	return kebabCase
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Generate package.json for programmatic capability.
 */
function generatePackageJson(id: string): string {
	const pkg = {
		name: `@capability/${id}`,
		version: "0.1.0",
		type: "module",
		main: "dist/index.js",
		scripts: {
			build: "npx @omnidev-ai/capability build",
			watch: "npx @omnidev-ai/capability build --watch",
		},
		dependencies: {
			"@omnidev-ai/capability": "latest",
		},
	};
	return JSON.stringify(pkg, null, "\t");
}

/**
 * Generate index.ts for programmatic capability.
 */
function generateIndexTs(id: string, name: string): string {
	const funcName = `run${id.replace(/-/g, "").replace(/^./, (c) => c.toUpperCase())}`;
	const varName = `${id.replace(/-/g, "")}Command`;

	return `/**
 * ${name} Capability
 *
 * A programmatic capability with CLI commands.
 */

import { command, type CapabilityExport } from "@omnidev-ai/capability";

// Example command implementation
async function ${funcName}(flags: { verbose?: boolean }): Promise<void> {
	console.log("Hello from ${name}!");
	console.log("");
	console.log("This is a programmatic capability.");
	console.log("Edit index.ts to customize this command.");

	if (flags.verbose) {
		console.log("");
		console.log("Verbose mode enabled.");
	}
}

// Build the main command
const ${varName} = command({
	brief: "${name} command",
	parameters: {
		flags: {
			verbose: {
				brief: "Show verbose output",
				kind: "boolean",
				optional: true,
			},
		},
	},
	func: ${funcName},
});

// Default export: Structured capability export
export default {
	cliCommands: {
		"${id}": ${varName},
	},
} satisfies CapabilityExport;
`;
}

/**
 * Generate .gitignore for programmatic capability.
 */
function generateGitignore(): string {
	return `dist/
node_modules/
`;
}

/**
 * Run the capability new command to bootstrap a new capability.
 */
export async function runCapabilityNew(
	flags: { path?: string; programmatic?: boolean },
	capabilityId: string,
): Promise<void> {
	try {
		// Check if OmniDev is initialized
		if (!existsSync(".omni")) {
			console.error("✗ OmniDev is not initialized in this directory.");
			console.log("");
			console.log("  Run: omnidev init");
			process.exit(1);
		}

		// Validate capability ID
		if (!isValidCapabilityId(capabilityId)) {
			console.error(`✗ Invalid capability ID: '${capabilityId}'`);
			console.log("");
			console.log("  ID must be lowercase, start with a letter, and use kebab-case");
			console.log("  Example: my-capability, tasks, api-client");
			process.exit(1);
		}

		const id = capabilityId;

		// Determine output path
		let capabilityDir: string;

		if (flags.path) {
			// Use provided path directly
			capabilityDir = flags.path;
		} else {
			// Prompt for output path with default
			const defaultPath = `capabilities/${id}`;
			capabilityDir = await input({
				message: "Output path:",
				default: defaultPath,
			});
		}

		// Check if capability already exists at that path
		if (existsSync(capabilityDir)) {
			console.error(`✗ Directory already exists at ${capabilityDir}`);
			process.exit(1);
		}

		// Derive name from ID
		const name = toTitleCase(id);

		// Create directory structure
		mkdirSync(capabilityDir, { recursive: true });

		// Write capability.toml
		const capabilityToml = generateCapabilityToml({ id, name });
		await writeFile(join(capabilityDir, "capability.toml"), capabilityToml, "utf-8");

		// Create skill template
		const skillDir = join(capabilityDir, "skills", "getting-started");
		mkdirSync(skillDir, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), generateSkillTemplate("getting-started"), "utf-8");

		// Create rule template
		const rulesDir = join(capabilityDir, "rules");
		mkdirSync(rulesDir, { recursive: true });
		await writeFile(
			join(rulesDir, "coding-standards.md"),
			generateRuleTemplate("coding-standards"),
			"utf-8",
		);

		// Create hooks template
		const hooksDir = join(capabilityDir, "hooks");
		mkdirSync(hooksDir, { recursive: true });
		await writeFile(join(hooksDir, "hooks.toml"), generateHooksTemplate(), "utf-8");
		await writeFile(join(hooksDir, "example-hook.sh"), generateHookScript(), "utf-8");

		// Create programmatic files if --programmatic flag is set
		if (flags.programmatic) {
			await writeFile(join(capabilityDir, "package.json"), generatePackageJson(id), "utf-8");
			await writeFile(join(capabilityDir, "index.ts"), generateIndexTs(id, name), "utf-8");
			await writeFile(join(capabilityDir, ".gitignore"), generateGitignore(), "utf-8");
		}

		console.log(`✓ Created capability: ${name}`);
		console.log(`  Location: ${capabilityDir}`);
		console.log("");
		console.log("  Files created:");
		console.log("    - capability.toml");
		console.log("    - skills/getting-started/SKILL.md");
		console.log("    - rules/coding-standards.md");
		console.log("    - hooks/hooks.toml");
		console.log("    - hooks/example-hook.sh");
		if (flags.programmatic) {
			console.log("    - package.json");
			console.log("    - index.ts");
			console.log("    - .gitignore");
		}
		console.log("");
		if (flags.programmatic) {
			console.log("💡 To build and use this capability:");
			console.log(`   cd ${capabilityDir}`);
			console.log("   npm install && npm run build");
			console.log(`   cd -`);
			console.log(`   omnidev add cap --local ./${capabilityDir}`);
		} else {
			console.log("💡 To add this capability as a local source, run:");
			console.log(`   omnidev add cap --local ./${capabilityDir}`);
		}
	} catch (error) {
		// Handle user cancellation (Ctrl+C) gracefully
		if (error instanceof Error && error.name === "ExitPromptError") {
			process.exit(0);
		}
		console.error("Error creating capability:", error);
		process.exit(1);
	}
}

const newCommand = buildCommand({
	docs: {
		brief: "Create a new capability with templates",
		fullDescription: `Create a new capability with templates at a specified path.

By default, creates the capability at capabilities/<id>. You can specify a custom path using the --path flag or interactively.

Use --programmatic to create a TypeScript capability with CLI commands, package.json, and esbuild setup.

Examples:
  omnidev capability new my-cap                         # Prompts for path, defaults to capabilities/my-cap
  omnidev capability new my-cap --path ./caps/my        # Uses ./caps/my directly
  omnidev capability new my-cap --programmatic          # Creates with TypeScript + CLI support`,
	},
	parameters: {
		flags: {
			path: {
				kind: "parsed" as const,
				brief: "Output path for the capability (skips interactive prompt)",
				parse: String,
				optional: true,
			},
			programmatic: {
				kind: "boolean" as const,
				brief: "Create a TypeScript capability with CLI commands and esbuild setup",
				optional: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Capability ID (kebab-case)",
					parse: String,
				},
			],
		},
		aliases: {
			p: "path",
		},
	},
	func: runCapabilityNew,
});

const listCommand = buildCommand({
	docs: {
		brief: "List all discovered capabilities",
		fullDescription: `List all discovered capabilities with their status.

Use --verbose to show additional version information including:
- Source (git URL or file path)
- Where the version was detected from
- Commit hash (for git sources)
- Content hash (for file sources)
- Last update time

Examples:
  omnidev capability list
  omnidev capability list --verbose`,
	},
	parameters: {
		flags: {
			verbose: {
				kind: "boolean" as const,
				brief: "Show detailed version information",
				optional: true,
			},
		},
	},
	async func(flags: { verbose?: boolean }) {
		await runCapabilityList(flags);
	},
});

const enableCommand = buildCommand({
	docs: {
		brief: "Enable a capability",
	},
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Capability name to enable",
					parse: String,
				},
			],
		},
	},
	func: runCapabilityEnable,
});

const disableCommand = buildCommand({
	docs: {
		brief: "Disable a capability",
	},
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Capability name to disable",
					parse: String,
				},
			],
		},
	},
	func: runCapabilityDisable,
});

export const capabilityRoutes = buildRouteMap({
	routes: {
		new: newCommand,
		list: listCommand,
		enable: enableCommand,
		disable: disableCommand,
	},
	docs: {
		brief: "Manage capabilities",
	},
});
