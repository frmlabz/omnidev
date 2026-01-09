import { existsSync } from "node:fs";
import type { OmniConfig } from "../types";
import { parseOmniConfig } from "./parser";

const CONFIG_PATH = ".omni/config.toml";
const LOCAL_CONFIG = ".omni/config.local.toml";

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
 * Load and merge config and local configuration files
 * @returns Merged OmniConfig object
 *
 * Reads .omni/config.toml (main config) and .omni/config.local.toml (local overrides).
 * Local config takes precedence over main config. Missing files are treated as empty configs.
 */
export async function loadConfig(): Promise<OmniConfig> {
	let baseConfig: OmniConfig = {};
	let localConfig: OmniConfig = {};

	if (existsSync(CONFIG_PATH)) {
		const content = await Bun.file(CONFIG_PATH).text();
		baseConfig = parseOmniConfig(content);
	}

	if (existsSync(LOCAL_CONFIG)) {
		const content = await Bun.file(LOCAL_CONFIG).text();
		localConfig = parseOmniConfig(content);
	}

	return mergeConfigs(baseConfig, localConfig);
}
