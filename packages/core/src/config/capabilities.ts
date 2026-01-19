import { loadBaseConfig, loadConfig, writeConfig } from "./config.js";
import { getActiveProfile, resolveEnabledCapabilities } from "./profiles.js";

/**
 * Get enabled capabilities for the active profile
 * Includes both profile-specific and always-enabled capabilities
 * @returns Array of enabled capability IDs
 */
export async function getEnabledCapabilities(): Promise<string[]> {
	const config = await loadConfig();
	const activeProfile = (await getActiveProfile()) ?? config.active_profile ?? "default";
	return resolveEnabledCapabilities(config, activeProfile);
}

/**
 * Enable a capability by adding it to the active profile's capabilities list
 * @param capabilityId - The ID of the capability to enable
 */
export async function enableCapability(capabilityId: string): Promise<void> {
	// Use loadBaseConfig to avoid writing local overrides to omni.toml
	const config = await loadBaseConfig();
	const activeProfile = (await getActiveProfile()) ?? config.active_profile ?? "default";

	if (!config.profiles) {
		config.profiles = {};
	}
	if (!config.profiles[activeProfile]) {
		config.profiles[activeProfile] = { capabilities: [] };
	}

	const capabilities = new Set(config.profiles[activeProfile].capabilities ?? []);
	capabilities.add(capabilityId);
	config.profiles[activeProfile].capabilities = Array.from(capabilities);

	await writeConfig(config);
}

/**
 * Disable a capability by removing it from the active profile's capabilities list
 * @param capabilityId - The ID of the capability to disable
 */
export async function disableCapability(capabilityId: string): Promise<void> {
	// Use loadBaseConfig to avoid writing local overrides to omni.toml
	const config = await loadBaseConfig();
	const activeProfile = (await getActiveProfile()) ?? config.active_profile ?? "default";

	if (!config.profiles?.[activeProfile]) {
		return; // Nothing to disable
	}

	const capabilities = new Set(config.profiles[activeProfile].capabilities ?? []);
	capabilities.delete(capabilityId);
	config.profiles[activeProfile].capabilities = Array.from(capabilities);

	await writeConfig(config);
}
