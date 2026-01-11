import { discoverCapabilities, loadCapability } from "../capability/loader.js";
import { addCapabilityPatterns, removeCapabilityPatterns } from "../gitignore/manager.js";
import { loadConfig, writeConfig } from "./loader.js";
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
 * Also adds the capability's gitignore patterns to .omni/.gitignore if present
 * @param capabilityId - The ID of the capability to enable
 */
export async function enableCapability(capabilityId: string): Promise<void> {
	const config = await loadConfig();
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

	// Add gitignore patterns if the capability exports them
	try {
		const capabilityPaths = await discoverCapabilities();
		for (const path of capabilityPaths) {
			const capability = await loadCapability(path, process.env as Record<string, string>);
			if (capability.id === capabilityId && capability.gitignore) {
				await addCapabilityPatterns(capabilityId, capability.gitignore);
				break;
			}
		}
	} catch (error) {
		// If we can't load the capability or add patterns, log but don't fail
		// This allows enabling capabilities even if gitignore management fails
		console.warn(`Warning: Could not add gitignore patterns for ${capabilityId}:`, error);
	}
}

/**
 * Disable a capability by removing it from the active profile's capabilities list
 * Also removes the capability's gitignore patterns from .omni/.gitignore
 * @param capabilityId - The ID of the capability to disable
 */
export async function disableCapability(capabilityId: string): Promise<void> {
	const config = await loadConfig();
	const activeProfile = (await getActiveProfile()) ?? config.active_profile ?? "default";

	if (!config.profiles?.[activeProfile]) {
		return; // Nothing to disable
	}

	const capabilities = new Set(config.profiles[activeProfile].capabilities ?? []);
	capabilities.delete(capabilityId);
	config.profiles[activeProfile].capabilities = Array.from(capabilities);

	await writeConfig(config);

	// Remove gitignore patterns
	try {
		await removeCapabilityPatterns(capabilityId);
	} catch (error) {
		// If we can't remove patterns, log but don't fail
		console.warn(`Warning: Could not remove gitignore patterns for ${capabilityId}:`, error);
	}
}
