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
	syncAgentConfiguration,
} from "@omnidev-ai/core";
import { buildCommand, buildRouteMap } from "@stricli/core";
import { isValidCapabilityId } from "../prompts/capability.js";

/**
 * Run the capability list command.
 */
export async function runCapabilityList(): Promise<void> {
	try {
		const enabledIds = await getEnabledCapabilities();
		const capabilityPaths = await discoverCapabilities();

		if (capabilityPaths.length === 0) {
			console.log("No capabilities found.");
			console.log("");
			console.log("To add capabilities, create directories in omni/capabilities/");
			console.log("Each capability must have a capability.toml file.");
			return;
		}

		console.log("Capabilities:");
		console.log("");

		for (const path of capabilityPaths) {
			try {
				const capConfig = await loadCapabilityConfig(path);
				const isEnabled = enabledIds.includes(capConfig.capability.id);
				const status = isEnabled ? "✓ enabled" : "✗ disabled";
				const { id, name, version } = capConfig.capability;

				console.log(`  ${status}  ${name}`);
				console.log(`           ID: ${id}`);
				console.log(`           Version: ${version}`);
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
 * Run the capability new command to bootstrap a new capability.
 */
export async function runCapabilityNew(
	flags: { path?: string },
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

		console.log(`✓ Created capability: ${name}`);
		console.log(`  Location: ${capabilityDir}`);
		console.log("");
		console.log("  Files created:");
		console.log("    - capability.toml");
		console.log("    - skills/getting-started/SKILL.md");
		console.log("    - rules/coding-standards.md");
		console.log("    - hooks/hooks.toml");
		console.log("    - hooks/example-hook.sh");
		console.log("");
		console.log("💡 To add this capability as a local source, run:");
		console.log(`   omnidev add cap --local ./${capabilityDir}`);
	} catch (error) {
		console.error("Error creating capability:", error);
		process.exit(1);
	}
}

const newCommand = buildCommand({
	docs: {
		brief: "Create a new capability with templates",
		fullDescription: `Create a new capability with templates at a specified path.

By default, creates the capability at capabilities/<id>. You can specify a custom path using the --path flag or interactively.

Examples:
  omnidev capability new my-cap                    # Prompts for path, defaults to capabilities/my-cap
  omnidev capability new my-cap --path ./caps/my   # Uses ./caps/my directly`,
	},
	parameters: {
		flags: {
			path: {
				kind: "parsed" as const,
				brief: "Output path for the capability (skips interactive prompt)",
				parse: String,
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
	},
	parameters: {},
	async func() {
		await runCapabilityList();
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
