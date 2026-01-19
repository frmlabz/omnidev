/**
 * Hooks loader
 *
 * Loads hooks configuration from capability directories.
 * Handles TOML parsing, validation, and variable transformation.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { HOOKS_DIRECTORY, HOOKS_CONFIG_FILENAME } from "./constants.js";
import type { HooksConfig, HookValidationResult, CapabilityHooks } from "./types.js";
import {
	validateHooksConfig,
	createEmptyHooksConfig,
	createEmptyValidationResult,
} from "./validation.js";
import { transformToOmnidev, containsClaudeVariables } from "./variables.js";

export interface LoadHooksOptions {
	/** Transform Claude variables to OmniDev format (default: true) */
	transformVariables?: boolean;
	/** Validate the hooks configuration (default: true) */
	validate?: boolean;
	/** Check script files exist and are executable (default: false) */
	checkScripts?: boolean;
}

export interface LoadHooksResult {
	/** The loaded hooks configuration (empty if not found or invalid) */
	config: HooksConfig;
	/** Validation result */
	validation: HookValidationResult;
	/** Whether hooks were found */
	found: boolean;
	/** Path to the hooks config file (if found) */
	configPath?: string;
	/** Any errors during loading (e.g., TOML parse error) */
	loadError?: string;
}

/**
 * Load hooks configuration from a capability directory
 *
 * Looks for hooks/hooks.toml within the capability directory.
 * Transforms variables and validates the configuration.
 */
export function loadHooksFromCapability(
	capabilityPath: string,
	options?: LoadHooksOptions,
): LoadHooksResult {
	const opts: LoadHooksOptions = {
		transformVariables: true,
		validate: true,
		checkScripts: false,
		...options,
	};

	const hooksDir = join(capabilityPath, HOOKS_DIRECTORY);
	const configPath = join(hooksDir, HOOKS_CONFIG_FILENAME);

	// Check if hooks config exists
	if (!existsSync(configPath)) {
		return {
			config: createEmptyHooksConfig(),
			validation: createEmptyValidationResult(),
			found: false,
		};
	}

	// Read and parse TOML
	let rawContent: string;
	try {
		rawContent = readFileSync(configPath, "utf-8");
	} catch (error) {
		return {
			config: createEmptyHooksConfig(),
			validation: {
				valid: false,
				errors: [
					{
						severity: "error",
						code: "HOOKS_INVALID_TOML",
						message: `Failed to read hooks config: ${error instanceof Error ? error.message : String(error)}`,
						path: configPath,
					},
				],
				warnings: [],
			},
			found: true,
			configPath,
			loadError: `Failed to read: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	// Transform Claude variables to OmniDev format before parsing
	let content = rawContent;
	if (opts.transformVariables && containsClaudeVariables(rawContent)) {
		content = transformToOmnidev(rawContent);
	}

	// Parse TOML
	let parsed: unknown;
	try {
		parsed = parseToml(content);
	} catch (error) {
		return {
			config: createEmptyHooksConfig(),
			validation: {
				valid: false,
				errors: [
					{
						severity: "error",
						code: "HOOKS_INVALID_TOML",
						message: `Invalid TOML syntax: ${error instanceof Error ? error.message : String(error)}`,
						path: configPath,
					},
				],
				warnings: [],
			},
			found: true,
			configPath,
			loadError: `Invalid TOML: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	// Validate
	let validation: HookValidationResult;
	if (opts.validate) {
		validation = validateHooksConfig(parsed, {
			basePath: hooksDir,
			checkScripts: opts.checkScripts ?? false,
		});
	} else {
		validation = createEmptyValidationResult();
	}

	// Return result
	return {
		config: validation.valid ? (parsed as HooksConfig) : createEmptyHooksConfig(),
		validation,
		found: true,
		configPath,
	};
}

/**
 * Load hooks and create CapabilityHooks metadata
 */
export function loadCapabilityHooks(
	capabilityName: string,
	capabilityPath: string,
	options?: LoadHooksOptions,
): CapabilityHooks | null {
	const result = loadHooksFromCapability(capabilityPath, options);

	if (!result.found) {
		return null;
	}

	return {
		capabilityName,
		capabilityPath,
		config: result.config,
		validation: result.validation,
	};
}

/**
 * Check if a capability has hooks defined
 */
export function hasHooks(capabilityPath: string): boolean {
	const configPath = join(capabilityPath, HOOKS_DIRECTORY, HOOKS_CONFIG_FILENAME);
	return existsSync(configPath);
}

/**
 * Get the hooks directory path for a capability
 */
export function getHooksDirectory(capabilityPath: string): string {
	return join(capabilityPath, HOOKS_DIRECTORY);
}

/**
 * Get the hooks config file path for a capability
 */
export function getHooksConfigPath(capabilityPath: string): string {
	return join(capabilityPath, HOOKS_DIRECTORY, HOOKS_CONFIG_FILENAME);
}
