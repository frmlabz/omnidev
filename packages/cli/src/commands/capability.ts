import { buildCommand, buildRouteMap } from '@stricli/core';
import { discoverCapabilities, loadCapabilityConfig } from '@omnidev/core';
import { loadConfig } from '@omnidev/core';
import { resolveEnabledCapabilities, getActiveProfile } from '@omnidev/core';

/**
 * Run the capability list command.
 */
export async function runCapabilityList(): Promise<void> {
	try {
		const config = await loadConfig();
		const activeProfile = await getActiveProfile();
		const enabledIds = resolveEnabledCapabilities(config, activeProfile);

		const capabilityPaths = await discoverCapabilities();

		if (capabilityPaths.length === 0) {
			console.log('No capabilities found.');
			console.log('');
			console.log('To add capabilities, create directories in omni/capabilities/');
			console.log('Each capability must have a capability.toml file.');
			return;
		}

		console.log('Capabilities:');
		console.log('');

		for (const path of capabilityPaths) {
			try {
				const capConfig = await loadCapabilityConfig(path);
				const isEnabled = enabledIds.includes(capConfig.capability.id);
				const status = isEnabled ? '✓ enabled' : '✗ disabled';
				const { id, name, version } = capConfig.capability;

				console.log(`  ${status}  ${name}`);
				console.log(`           ID: ${id}`);
				console.log(`           Version: ${version}`);
				console.log('');
			} catch (error) {
				console.error(`  ✗ Failed to load capability at ${path}:`, error);
				console.log('');
			}
		}
	} catch (error) {
		console.error('Error listing capabilities:', error);
		process.exit(1);
	}
}

const listCommand = buildCommand({
	docs: {
		brief: 'List all discovered capabilities',
	},
	parameters: {},
	async func() {
		await runCapabilityList();
	},
});

export const capabilityRoutes = buildRouteMap({
	routes: {
		list: listCommand,
	},
	docs: {
		brief: 'Manage capabilities',
	},
});
