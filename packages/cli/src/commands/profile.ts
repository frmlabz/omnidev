import { buildCommand, buildRouteMap } from "@stricli/core";
import { existsSync } from "node:fs";
import {
	getActiveProfile,
	loadConfig,
	loadProfiles,
	resolveEnabledCapabilities,
	setActiveProfile,
	setProfile,
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

async function runCreateCommand(_flags: Record<string, never>, profileName: string): Promise<void> {
	await runProfileCreate(profileName);
}

const createCommand = buildCommand({
	docs: {
		brief: "Create a new profile",
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
	func: runCreateCommand,
});

export const profileRoutes = buildRouteMap({
	routes: {
		list: listCommand,
		set: setCommand,
		create: createCommand,
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

		// Load config and profiles
		const config = await loadConfig();
		const profilesConfig = await loadProfiles();

		// Get active profile
		const activeProfile = existsSync(".omni/active-profile")
			? await getActiveProfile()
			: (config.default_profile ?? "default");

		// Check if profiles exist
		const profiles = profilesConfig.profiles ?? {};
		const profileNames = Object.keys(profiles);

		if (profileNames.length === 0) {
			console.log("No profiles defined in profiles.toml");
			console.log("");
			console.log("Using default capabilities from capabilities.toml");
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

		// Load profiles
		const profilesConfig = await loadProfiles();

		// Validate profile exists
		const profiles = profilesConfig.profiles ?? {};
		if (!(profileName in profiles)) {
			console.log(`✗ Profile "${profileName}" not found in profiles.toml`);
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

export async function runProfileCreate(profileName: string): Promise<void> {
	try {
		// Check if .omni/config.toml exists
		if (!existsSync(".omni/config.toml")) {
			console.log("✗ No config file found");
			console.log("  Run: omnidev init");
			process.exit(1);
		}

		// Load profiles
		const profilesConfig = await loadProfiles();

		// Check if profile already exists
		const profiles = profilesConfig.profiles ?? {};
		if (profileName in profiles) {
			console.log(`✗ Profile "${profileName}" already exists`);
			console.log("");
			console.log("Use 'dev profile list' to see all profiles");
			console.log("Or edit .omni/profiles.toml directly to modify it");
			process.exit(1);
		}

		// Create new empty profile
		await setProfile(profileName, {
			enable: [],
			disable: [],
		});

		console.log(`✓ Created profile: ${profileName}`);
		console.log("");
		console.log("Next steps:");
		console.log("  1. Edit .omni/profiles.toml to configure capability lists");
		console.log(`  2. Run 'dev profile set ${profileName}' to activate it`);
	} catch (error) {
		console.error("✗ Error creating profile:", error);
		process.exit(1);
	}
}
