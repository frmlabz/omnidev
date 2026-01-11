import {
	disableCapability,
	discoverCapabilities,
	enableCapability,
	getEnabledCapabilities,
	loadCapabilityConfig,
	syncAgentConfiguration,
} from "@omnidev/core";
import { buildCommand, buildRouteMap } from "@stricli/core";

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

		// Auto-sync agent configuration
		await syncAgentConfiguration();
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

		// Auto-sync agent configuration
		await syncAgentConfiguration();
	} catch (error) {
		console.error("Error disabling capability:", error);
		process.exit(1);
	}
}

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
		list: listCommand,
		enable: enableCommand,
		disable: disableCommand,
	},
	docs: {
		brief: "Manage capabilities",
	},
});
