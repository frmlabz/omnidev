import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CAPABILITIES_DIR = 'omni/capabilities';

/**
 * Discovers capabilities by scanning the omni/capabilities directory.
 * A directory is considered a capability if it contains a capability.toml file.
 *
 * @returns Array of capability directory paths
 */
export async function discoverCapabilities(): Promise<string[]> {
	if (!existsSync(CAPABILITIES_DIR)) {
		return [];
	}

	const entries = readdirSync(CAPABILITIES_DIR, { withFileTypes: true });
	const capabilities: string[] = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const configPath = join(CAPABILITIES_DIR, entry.name, 'capability.toml');
			if (existsSync(configPath)) {
				capabilities.push(join(CAPABILITIES_DIR, entry.name));
			}
		}
	}

	return capabilities;
}
