import { existsSync } from "node:fs";
import type { OmniConfig } from "../types";
import { parseOmniConfig } from "./parser";

const CONFIG_PATH = "omni.toml";
const LOCAL_CONFIG = "omni.local.toml";

/**
 * Deep merge two config objects, with override taking precedence
 * @param base - The base config object
 * @param override - The override config object
 * @returns Merged config with override values taking precedence
 */
function mergeConfigs(base: OmniConfig, override: OmniConfig): OmniConfig {
	const merged: OmniConfig = { ...base, ...override };

	// Deep merge env
	merged.env = { ...base.env, ...override.env };

	// Deep merge profiles
	merged.profiles = { ...base.profiles };
	for (const [name, profile] of Object.entries(override.profiles || {})) {
		merged.profiles[name] = {
			...(base.profiles?.[name] || {}),
			...profile,
		};
	}

	return merged;
}

/**
 * Load and merge config and local configuration files
 * @returns Merged OmniConfig object
 *
 * Reads omni.toml (main config) and omni.local.toml (local overrides).
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

/**
 * Write config to omni.toml at project root
 * @param config - The config object to write
 */
export async function writeConfig(config: OmniConfig): Promise<void> {
	const content = generateConfigToml(config);
	await Bun.write(CONFIG_PATH, content);
}

/**
 * Generate TOML content for OmniConfig
 * @param config - The config object
 * @returns TOML string
 */
function generateConfigToml(config: OmniConfig): string {
	const lines: string[] = [];

	lines.push("# OmniDev Configuration");
	lines.push("# Main configuration for your OmniDev project");
	lines.push("");

	// Project name
	if (config.project) {
		lines.push(`project = "${config.project}"`);
	}

	// Note: active_profile is stored in .omni/state/active-profile, not in config.toml
	// We still read it from config.toml for backwards compatibility, but don't write it here

	// Sandbox mode
	if (config.sandbox_enabled !== undefined) {
		lines.push(`sandbox_enabled = ${config.sandbox_enabled}`);
	}

	lines.push("");

	// Providers
	if (config.providers?.enabled && config.providers.enabled.length > 0) {
		lines.push("[providers]");
		lines.push(`enabled = [${config.providers.enabled.map((p) => `"${p}"`).join(", ")}]`);
		lines.push("");
	}

	// Environment variables
	if (config.env && Object.keys(config.env).length > 0) {
		lines.push("[env]");
		for (const [key, value] of Object.entries(config.env)) {
			lines.push(`${key} = "${value}"`);
		}
		lines.push("");
	}

	// Capability sources (commented examples)
	lines.push("# =============================================================================");
	lines.push("# Capability Sources");
	lines.push("# =============================================================================");
	lines.push("# Fetch capabilities from Git repositories. On sync, these are cloned/updated");
	lines.push("# and wrapped into capabilities automatically.");
	lines.push("#");
	lines.push("# [capabilities.sources]");
	lines.push("# # Simple GitHub reference (auto-wrapped if no capability.toml)");
	lines.push('# obsidian = "github:kepano/obsidian-skills"');
	lines.push("#");
	lines.push("# # Full configuration with version pinning");
	lines.push('# my-cap = { source = "github:user/repo", ref = "v1.0.0" }');
	lines.push("#");
	lines.push("# # Force wrap mode (generate capability.toml from discovered content)");
	lines.push('# external = { source = "github:user/skills-repo", type = "wrap" }');
	lines.push("");

	// Profiles
	if (config.profiles && Object.keys(config.profiles).length > 0) {
		for (const [name, profile] of Object.entries(config.profiles)) {
			lines.push(`[profiles.${name}]`);
			const capabilities = profile.capabilities ?? [];
			lines.push(`capabilities = [${capabilities.map((id) => `"${id}"`).join(", ")}]`);
			lines.push("");
		}
	}

	return lines.join("\n");
}
