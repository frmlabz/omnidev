import { buildCommand } from "@stricli/core";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import type { Provider } from "@omnidev/core";
import {
	writeProviderConfig,
	parseProviderFlag,
	generateAgentsTemplate,
	generateClaudeTemplate,
	generateClaudeAppendSection,
	writeCapabilitiesState,
	writeProfiles,
	hasOldStructure,
	hasNewStructure,
	getMigrationSummary,
	migrateStructure,
} from "@omnidev/core";
import { promptForProvider } from "../prompts/provider.js";
import { confirm } from "@inquirer/prompts";

export async function runInit(_flags: Record<string, never>, provider?: string) {
	console.log("Initializing OmniDev...");

	// Check for old omni/ structure and offer migration
	if (hasOldStructure() && !hasNewStructure()) {
		console.log("");
		console.log("⚠️  Found old OmniDev structure (omni/ folder)");
		console.log("");
		console.log("Would you like to migrate to the new .omni/ structure?");
		console.log("This will:");
		const summary = getMigrationSummary();
		for (const line of summary) {
			console.log(`  ${line}`);
		}
		console.log("");

		const shouldMigrate = await confirm({
			message: "Proceed with migration?",
			default: true,
		});

		if (shouldMigrate) {
			console.log("");
			console.log("Migrating to new structure...");
			try {
				await migrateStructure();
				console.log("✓ Migration completed successfully!");
				console.log("");
			} catch (error) {
				console.error(
					"✗ Migration failed:",
					error instanceof Error ? error.message : String(error),
				);
				process.exit(1);
			}
		} else {
			console.log("");
			console.log("Migration cancelled. OmniDev will not be initialized.");
			process.exit(0);
		}
	}

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

	// Create .omni/capabilities.toml with no capabilities enabled
	if (!existsSync(".omni/capabilities.toml")) {
		await writeCapabilitiesState({ enabled: [], disabled: [] });
	}

	// Create .omni/profiles.toml with default profiles
	if (!existsSync(".omni/profiles.toml")) {
		await writeProfiles(defaultProfiles());
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
# Main configuration for your OmniDev project
#
# This file controls:
#   - Project name
#   - Default profile (see profiles.toml for profile definitions)
#
# Other configuration files:
#   - capabilities.toml   - Which capabilities are enabled
#   - profiles.toml       - Profile definitions and capability overrides
#   - provider.toml       - AI provider selection (claude/codex)
#   - .gitignore         - Working files that are always ignored

project = "my-project"
default_profile = "default"
`;
}

function defaultProfiles() {
	return {
		profiles: {
			default: {},
			planning: {
				enable: [],
				disable: [],
			},
			coding: {
				enable: [],
				disable: [],
			},
		},
	};
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
