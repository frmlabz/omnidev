import { readActiveProfileState, writeActiveProfileState } from "../state/active-profile.js";
import type { OmniConfig, ProfileConfig } from "../types/index.js";
import { loadConfig, writeConfig } from "./config.js";

/**
 * Gets the name of the currently active profile from the state file.
 * Returns null if no profile is set.
 */
export async function getActiveProfile(): Promise<string | null> {
	return await readActiveProfileState();
}

/**
 * Sets the active profile by writing to state file.
 * @param name - The name of the profile to activate
 */
export async function setActiveProfile(name: string): Promise<void> {
	await writeActiveProfileState(name);
}

/**
 * Resolves the enabled capabilities for a given profile
 *
 * @param config - The merged OmniConfig
 * @param profileName - The name of the profile to apply, or null to use active
 * @returns Array of capability IDs that should be enabled
 */
export function resolveEnabledCapabilities(
	config: OmniConfig,
	profileName: string | null,
): string[] {
	// Use the default profile if no profile name is specified
	const profile = profileName ? config.profiles?.[profileName] : config.profiles?.["default"];

	const profileCapabilities = profile?.capabilities ?? [];
	const alwaysEnabled = config.capabilities?.always_enabled ?? [];
	const alwaysDisabled = config.capabilities?.always_disabled ?? [];
	const groups = config.capabilities?.groups ?? {};

	// Expand group references (group:name -> constituent capabilities)
	const expandCapabilities = (caps: string[]): string[] => {
		return caps.flatMap((cap) => {
			if (cap.startsWith("group:")) {
				const groupName = cap.slice(6);
				const groupCaps = groups[groupName];
				if (!groupCaps) {
					console.warn(`Unknown capability group: ${groupName}`);
					return [];
				}
				return groupCaps;
			}
			return cap;
		});
	};

	const expandedAlways = expandCapabilities(alwaysEnabled);
	const expandedProfile = expandCapabilities(profileCapabilities);
	const expandedDisabled = new Set(expandCapabilities(alwaysDisabled));

	// Merge always-enabled capabilities with profile capabilities (deduplicated)
	// Then filter out always_disabled capabilities
	const allEnabled = [...new Set([...expandedAlways, ...expandedProfile])];
	return allEnabled.filter((cap) => !expandedDisabled.has(cap));
}

/**
 * Load a specific profile configuration from config.toml
 * @param profileName - Name of the profile to load
 * @returns ProfileConfig if found, undefined otherwise
 */
export async function loadProfileConfig(profileName: string): Promise<ProfileConfig | undefined> {
	const config = await loadConfig();
	return config.profiles?.[profileName];
}

/**
 * Set a profile configuration in config.toml
 * @param profileName - Name of the profile to set
 * @param profileConfig - Profile configuration
 */
export async function setProfile(profileName: string, profileConfig: ProfileConfig): Promise<void> {
	const config = await loadConfig();
	if (!config.profiles) {
		config.profiles = {};
	}
	config.profiles[profileName] = profileConfig;
	await writeConfig(config);
}
