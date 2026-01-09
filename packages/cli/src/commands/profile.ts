import { buildCommand, buildRouteMap } from "@stricli/core";
import { existsSync } from "node:fs";
import {
	getActiveProfile,
	loadConfig,
	resolveEnabledCapabilities,
	setActiveProfile,
} from "@omnidev/core";

const listCommand = buildCommand({
	docs: {
		brief: "List available profiles",
	},
	parameters: {},
	async func() {
		await runProfileList();
	},
});

async function runSetCommand(_flags: Record<string, never>, profileName: string): Promise<void> {
	await runProfileSet(profileName);
}

const setCommand = buildCommand({
	docs: {
		brief: "Set the active profile",
	},
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Profile name",
					parse: String,
				},
			],
		},
	},
	func: runSetCommand,
});

export const profileRoutes = buildRouteMap({
	routes: {
		list: listCommand,
		set: setCommand,
	},
	docs: {
		brief: "Manage capability profiles",
	},
});

export async function runProfileList(): Promise<void> {
	try {
		// Check if .omni/config.toml exists
		if (!existsSync(".omni/config.toml")) {
			console.log("✗ No config file found");
			console.log("  Run: omnidev init");
			process.exit(1);
		}

		// Load config
		const config = await loadConfig();

		// Get active profile
		const activeProfile = existsSync(".omni/active-profile")
			? await getActiveProfile()
			: (config.default_profile ?? "default");

		// Check if profiles exist
		const profiles = config.profiles ?? {};
		const profileNames = Object.keys(profiles);

		if (profileNames.length === 0) {
			console.log("No profiles defined in config.toml");
			console.log("");
			console.log("Using default capabilities from [capabilities] section");
			return;
		}

		// Display profiles
		console.log("Available Profiles:");
		console.log("");

		for (const name of profileNames) {
			const isActive = name === activeProfile;
			const icon = isActive ? "●" : "○";
			const profile = profiles[name];

			if (profile === undefined) {
				continue;
			}

			console.log(`${icon} ${name}${isActive ? " (active)" : ""}`);

			// Show enabled/disabled capabilities
			const enabledCaps = resolveEnabledCapabilities(config, name);
			const enableList = profile.enable ?? [];
			const disableList = profile.disable ?? [];

			if (enableList.length > 0) {
				console.log(`  Enable: ${enableList.join(", ")}`);
			}
			if (disableList.length > 0) {
				console.log(`  Disable: ${disableList.join(", ")}`);
			}
			if (enableList.length === 0 && disableList.length === 0) {
				console.log("  Uses base capabilities");
			}
			console.log(`  Final: ${enabledCaps.join(", ") || "none"}`);
			console.log("");
		}
	} catch (error) {
		console.error("✗ Error loading profiles:", error);
		process.exit(1);
	}
}

export async function runProfileSet(profileName: string): Promise<void> {
	try {
		// Check if .omni/config.toml exists
		if (!existsSync(".omni/config.toml")) {
			console.log("✗ No config file found");
			console.log("  Run: omnidev init");
			process.exit(1);
		}

		// Load config
		const config = await loadConfig();

		// Validate profile exists
		const profiles = config.profiles ?? {};
		if (!(profileName in profiles)) {
			console.log(`✗ Profile "${profileName}" not found in config.toml`);
			console.log("");
			console.log("Available profiles:");
			const profileNames = Object.keys(profiles);
			if (profileNames.length === 0) {
				console.log("  (none defined)");
			} else {
				for (const name of profileNames) {
					console.log(`  - ${name}`);
				}
			}
			process.exit(1);
		}

		// Set active profile
		await setActiveProfile(profileName);

		console.log(`✓ Active profile set to: ${profileName}`);
		console.log("");

		// Trigger agents sync
		console.log("Syncing agent configuration...");
		// Note: agents sync will be implemented in US-030
		// For now, we just inform the user to run it manually
		console.log("  Note: agents sync not yet implemented");
		console.log("  Run: omnidev agents sync (when available)");
	} catch (error) {
		console.error("✗ Error setting profile:", error);
		process.exit(1);
	}
}
