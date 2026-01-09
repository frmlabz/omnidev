import { existsSync } from 'node:fs';
import type { OmniConfig } from '../types';
import { parseOmniConfig } from './parser';

const TEAM_CONFIG = 'omni/config.toml';
const LOCAL_CONFIG = '.omni/config.local.toml';

/**
 * Deep merge two config objects, with override taking precedence
 * @param base - The base config object
 * @param override - The override config object
 * @returns Merged config with override values taking precedence
 */
function mergeConfigs(base: OmniConfig, override: OmniConfig): OmniConfig {
	return {
		...base,
		...override,
		capabilities: {
			enable: [...(base.capabilities?.enable ?? []), ...(override.capabilities?.enable ?? [])],
			disable: [...(base.capabilities?.disable ?? []), ...(override.capabilities?.disable ?? [])],
		},
		env: {
			...base.env,
			...override.env,
		},
		profiles: {
			...base.profiles,
			...override.profiles,
		},
	};
}

/**
 * Load and merge team and local configuration files
 * @returns Merged OmniConfig object
 *
 * Reads omni/config.toml (team config) and .omni/config.local.toml (local config).
 * Local config takes precedence over team config. Missing files are treated as empty configs.
 */
export async function loadConfig(): Promise<OmniConfig> {
	let teamConfig: OmniConfig = {};
	let localConfig: OmniConfig = {};

	if (existsSync(TEAM_CONFIG)) {
		const content = await Bun.file(TEAM_CONFIG).text();
		teamConfig = parseOmniConfig(content);
	}

	if (existsSync(LOCAL_CONFIG)) {
		const content = await Bun.file(LOCAL_CONFIG).text();
		localConfig = parseOmniConfig(content);
	}

	return mergeConfigs(teamConfig, localConfig);
}
