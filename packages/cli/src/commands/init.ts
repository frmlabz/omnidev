import { existsSync, mkdirSync } from "node:fs";
import type { Provider } from "@omnidev/core";
import {
	generateAgentsTemplate,
	generateClaudeTemplate,
	generateInstructionsTemplate,
	parseProviderFlag,
	setActiveProfile,
	syncAgentConfiguration,
	writeConfig,
} from "@omnidev/core";
import { buildCommand } from "@stricli/core";
import { promptForProvider } from "../prompts/provider.js";

export async function runInit(_flags: Record<string, never>, provider?: string) {
	console.log("Initializing OmniDev...");

	// Create .omni/ directory structure
	mkdirSync(".omni", { recursive: true });
	mkdirSync(".omni/capabilities", { recursive: true });
	mkdirSync(".omni/state", { recursive: true });
	mkdirSync(".omni/sandbox", { recursive: true });

	// Create .omni/.gitignore for internal working files
	if (!existsSync(".omni/.gitignore")) {
		await Bun.write(".omni/.gitignore", internalGitignore());
	}

	// Get provider selection
	let providers: Provider[];
	if (provider) {
		providers = parseProviderFlag(provider);
	} else {
		providers = await promptForProvider();
	}

	// Create omni.toml at project root
	if (!existsSync("omni.toml")) {
		await writeConfig({
			project: "my-project",
			providers: {
				enabled: providers,
			},
			profiles: {
				default: {
					capabilities: [],
				},
				planning: {
					capabilities: [],
				},
				coding: {
					capabilities: [],
				},
			},
		});
		// Set active profile in state file (not omni.toml)
		await setActiveProfile("default");
	}

	// Create .omni/instructions.md
	if (!existsSync(".omni/instructions.md")) {
		await Bun.write(".omni/instructions.md", generateInstructionsTemplate());
	}

	// Create provider-specific files
	const fileStatus = await createProviderFiles(providers);

	// Run initial sync
	await syncAgentConfiguration({ silent: false });

	console.log("");
	console.log(`✓ OmniDev initialized for ${providers.join(" and ")}!`);
	console.log("");

	// Show appropriate message based on file status
	const hasNewFiles = fileStatus.created.length > 0;
	const hasExistingFiles = fileStatus.existing.length > 0;

	if (hasNewFiles) {
		console.log("📝 Don't forget to add your project description to:");
		console.log("   • .omni/instructions.md");
	}

	if (hasExistingFiles) {
		console.log("📝 Add this line to your existing file(s):");
		for (const file of fileStatus.existing) {
			console.log(`   • ${file}: @import .omni/instructions.md`);
		}
	}

	console.log("");
	console.log("🔌 Add OmniDev MCP Server to your AI provider:");
	console.log("");
	console.log("   Add to Claude Desktop config:");
	console.log("   {");
	console.log('     "mcpServers": {');
	console.log('       "omnidev": {');
	console.log('         "command": "npx",');
	console.log('         "args": ["-y", "@omnidev/cli", "serve"]');
	console.log("       }");
	console.log("     }");
	console.log("   }");
	console.log("");
	console.log("   Or for local development:");
	console.log("   {");
	console.log('     "mcpServers": {');
	console.log('       "omnidev": {');
	console.log('         "command": "bun",');
	console.log('         "args": ["run", "omnidev", "serve"],');
	console.log('         "cwd": "/path/to/your/project"');
	console.log("       }");
	console.log("     }");
	console.log("   }");
	console.log("");
	console.log("📁 File structure:");
	console.log("   • omni.toml - Main config (commit to share with team)");
	console.log("   • omni.lock.toml - Lock file (commit for reproducibility)");
	console.log("   • omni.local.toml - Local overrides (add to .gitignore)");
	console.log("   • .omni/ - Runtime directory (add to .gitignore)");
}

export const initCommand = buildCommand({
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "AI provider: claude, codex, or both",
					parse: String,
					optional: true,
				},
			],
		},
	},
	docs: {
		brief: "Initialize OmniDev in the current project",
	},
	func: runInit,
});

async function createProviderFiles(
	providers: Provider[],
): Promise<{ created: string[]; existing: string[] }> {
	const created: string[] = [];
	const existing: string[] = [];

	// Create AGENTS.md for Codex
	if (providers.includes("codex")) {
		if (!existsSync("AGENTS.md")) {
			await Bun.write("AGENTS.md", generateAgentsTemplate());
			created.push("AGENTS.md");
		} else {
			existing.push("AGENTS.md");
		}
	}

	// Create CLAUDE.md for Claude
	if (providers.includes("claude")) {
		if (!existsSync("CLAUDE.md")) {
			await Bun.write("CLAUDE.md", generateClaudeTemplate());
			created.push("CLAUDE.md");
		} else {
			existing.push("CLAUDE.md");
		}
	}

	return { created, existing };
}

function internalGitignore(): string {
	return `# OmniDev working files - always ignored
# These files change frequently and are machine-specific

# Secrets
.env

# Runtime state
state/

# Sandbox execution
sandbox/

# Logs
*.log

# MCP server process ID
server.pid

# Capability-specific patterns are appended below by each capability
`;
}
