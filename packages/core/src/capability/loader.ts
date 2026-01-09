import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CapabilityConfig } from '../types';
import { parseCapabilityConfig } from '../config/parser';

const CAPABILITIES_DIR = 'omni/capabilities';

/**
 * Reserved capability names that cannot be used.
 * These are common package names that might conflict with imports.
 */
const RESERVED_NAMES = [
	'fs',
	'path',
	'http',
	'https',
	'crypto',
	'os',
	'child_process',
	'stream',
	'buffer',
	'util',
	'events',
	'net',
	'url',
	'querystring',
	'react',
	'vue',
	'lodash',
	'axios',
	'express',
	'typescript',
];

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

/**
 * Loads and parses a capability configuration file.
 * Validates required fields and checks for reserved names.
 *
 * @param capabilityPath - Path to the capability directory
 * @returns Parsed capability configuration
 * @throws Error if the config is invalid or uses a reserved name
 */
export async function loadCapabilityConfig(capabilityPath: string): Promise<CapabilityConfig> {
	const configPath = join(capabilityPath, 'capability.toml');
	const content = await Bun.file(configPath).text();
	const config = parseCapabilityConfig(content);

	// Validate name is not reserved
	if (RESERVED_NAMES.includes(config.capability.id)) {
		throw new Error(
			`Capability name "${config.capability.id}" is reserved. Choose a different name.`,
		);
	}

	return config;
}
