import { buildCommand } from "@stricli/core";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import type { Provider } from "@omnidev/core";
import {
	writeProviderConfig,
	parseProviderFlag,
	generateAgentsTemplate,
	generateClaudeTemplate,
	generateClaudeAppendSection,
} from "@omnidev/core";
import { promptForProvider } from "../prompts/provider.js";

export async function runInit(_flags: Record<string, never>, provider?: string) {
	console.log("Initializing OmniDev...");

	// Create .omni/ directory structure
	mkdirSync(".omni", { recursive: true });
	mkdirSync(".omni/capabilities", { recursive: true });
	mkdirSync(".omni/generated", { recursive: true });
	mkdirSync(".omni/state", { recursive: true });
	mkdirSync(".omni/sandbox", { recursive: true });

	// Create .omni/config.toml
	if (!existsSync(".omni/config.toml")) {
		await Bun.write(".omni/config.toml", defaultConfig());
	}

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

	// Save provider config
	await writeProviderConfig({ providers });

	// Create provider-specific files
	await createProviderFiles(providers);

	console.log(`✓ OmniDev initialized for ${providers.join(" and ")}!`);
	console.log("");
	console.log("📝 Don't forget to add your project description to:");
	for (const p of providers) {
		if (p === "codex") {
			console.log("   • AGENTS.md (Codex)");
		} else if (p === "claude") {
			console.log("   • .claude/claude.md (Claude)");
		}
	}
	console.log("");
	console.log("📁 Sharing options:");
	console.log("   • To share config with team: commit the .omni/ folder");
	console.log("   • To keep personal: add '.omni' to your project's .gitignore");
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

function defaultConfig(): string {
	return `# OmniDev Configuration
project = "my-project"
default_profile = "default"

[capabilities]
enable = ["tasks"]
disable = []

[profiles.default]
# Default profile uses base capabilities

[profiles.planning]
enable = ["tasks"]
disable = []

[profiles.coding]
enable = ["tasks"]
disable = []
`;
}

async function createProviderFiles(providers: Provider[]) {
	// Create AGENTS.md for Codex
	if (providers.includes("codex")) {
		if (!existsSync("AGENTS.md")) {
			await Bun.write("AGENTS.md", generateAgentsTemplate());
		}
	}

	// Create/append to .claude/claude.md for Claude
	if (providers.includes("claude")) {
		mkdirSync(".claude", { recursive: true });

		if (!existsSync(".claude/claude.md")) {
			// Create new file
			await Bun.write(".claude/claude.md", generateClaudeTemplate());
		} else {
			// Check if OmniDev section already exists
			const existingContent = await Bun.file(".claude/claude.md").text();
			if (!existingContent.includes("# OmniDev Configuration")) {
				// Append OmniDev section
				appendFileSync(".claude/claude.md", generateClaudeAppendSection());
			}
		}
	}
}

function internalGitignore(): string {
	return `# OmniDev working files - always ignored
# These files change frequently and are machine-specific

# Secrets
.env

# Generated content (rebuilt on sync)
generated/

# Runtime state
state/

# Sandbox execution
sandbox/

# Logs
*.log

# Capability-specific patterns are appended below by each capability
`;
}
