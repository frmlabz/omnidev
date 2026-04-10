/**
 * Hooks loader
 *
 * Loads hooks configuration from capability directories.
 * Handles TOML and JSON parsing, validation, and variable transformation.
 *
 * Supported file locations (in priority order):
 * 1. hooks/hooks.toml (OmniDev native format)
 * 2. hooks/hooks.json (Claude plugin format in hooks directory)
 * 3. hooks.json (Claude plugin format at root)
 *
 * If hooks.toml exists, it takes priority. Otherwise, hooks.json files are loaded and merged.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import {
	HOOKS_DIRECTORY,
	HOOKS_CONFIG_FILENAME,
	CLAUDE_HOOKS_CONFIG_FILENAME,
	CODEX_HOOK_EVENTS,
	CODEX_MATCHER_EVENTS,
	CODEX_PROMPT_HOOK_EVENTS,
	CLAUDE_HOOK_EVENTS,
	SHARED_HOOK_EVENTS,
	SHARED_MATCHER_EVENTS,
	SHARED_PROMPT_HOOK_EVENTS,
} from "./constants";
import type {
	HooksConfig,
	HookValidationResult,
	CapabilityHooks,
	ProviderHooksConfig,
} from "./types";
import {
	validateHooksConfig,
	createEmptyHooksConfig,
	createEmptyValidationResult,
} from "./validation";
import {
	transformToOmnidev,
	containsClaudeVariables,
	resolveCapabilityRootInConfig,
	resolveCapabilityRootInValue,
} from "./variables";
import { loadHooksJson } from "./json-loader";
import { HOOK_EVENTS } from "./constants";
import type { HookMatcher } from "./types";

export interface LoadHooksOptions {
	/** Transform Claude variables to OmniDev format (default: true) */
	transformVariables?: boolean;
	/** Validate the hooks configuration (default: true) */
	validate?: boolean;
	/** Check script files exist and are executable (default: false) */
	checkScripts?: boolean;
	/** Resolve capability root variables to absolute paths (default: false) */
	resolveCapabilityRoot?: boolean;
}

export interface LoadHooksResult {
	/** The loaded hooks configuration (empty if not found or invalid) */
	config: HooksConfig;
	/** Optional provider-scoped hook config from [claude]/[codex] sections */
	providerConfigs?: ProviderHooksConfig;
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
 * Looks for hooks configuration in the following locations (in priority order):
 * 1. hooks/hooks.toml (OmniDev native format)
 * 2. hooks/hooks.json (Claude plugin format in hooks directory)
 * 3. hooks.json (Claude plugin format at root)
 *
 * If hooks.toml exists, it takes priority. Otherwise, hooks.json files are loaded and merged.
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
		resolveCapabilityRoot: false,
		...options,
	};

	const hooksDir = join(capabilityPath, HOOKS_DIRECTORY);
	const tomlConfigPath = join(hooksDir, HOOKS_CONFIG_FILENAME);

	// Check for hooks.toml first (takes priority)
	if (existsSync(tomlConfigPath)) {
		return loadTomlHooks(capabilityPath, tomlConfigPath, hooksDir, opts);
	}

	// Check for hooks.json files (Claude plugin format)
	const hooksJsonInDir = join(hooksDir, CLAUDE_HOOKS_CONFIG_FILENAME);
	const hooksJsonAtRoot = join(capabilityPath, CLAUDE_HOOKS_CONFIG_FILENAME);

	const hooksJsonDirExists = existsSync(hooksJsonInDir);
	const hooksJsonRootExists = existsSync(hooksJsonAtRoot);

	if (!hooksJsonDirExists && !hooksJsonRootExists) {
		return {
			config: createEmptyHooksConfig(),
			validation: createEmptyValidationResult(),
			found: false,
		};
	}

	// Load hooks.json files and merge
	return loadJsonHooksFiles(capabilityPath, hooksJsonInDir, hooksJsonAtRoot, hooksDir, opts);
}

const PROVIDER_SECTION_KEYS = ["claude", "codex"] as const;

function splitHooksTomlConfig(parsed: unknown): {
	sharedConfig: unknown;
	providerConfigs: ProviderHooksConfig | undefined;
	topLevelIssues: HookValidationResult["errors"];
} {
	const topLevelIssues: HookValidationResult["errors"] = [];

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return {
			sharedConfig: parsed,
			providerConfigs: undefined,
			topLevelIssues,
		};
	}

	const parsedObj = parsed as Record<string, unknown>;
	const sharedConfig: Record<string, unknown> = {};
	const providerConfigs: ProviderHooksConfig = {};

	for (const [key, value] of Object.entries(parsedObj)) {
		if (key === "description" || (SHARED_HOOK_EVENTS as readonly string[]).includes(key)) {
			sharedConfig[key] = value;
			continue;
		}

		if ((PROVIDER_SECTION_KEYS as readonly string[]).includes(key)) {
			if (value && typeof value === "object" && !Array.isArray(value)) {
				providerConfigs[key as keyof ProviderHooksConfig] = value as Record<string, unknown>;
			} else {
				topLevelIssues.push({
					severity: "error",
					code: "HOOKS_INVALID_TOML",
					message: `[${key}] must be a table`,
				});
			}
			continue;
		}

		topLevelIssues.push({
			severity: "error",
			code: "HOOKS_UNKNOWN_EVENT",
			message: `Unknown hook event: "${key}"`,
			suggestion: `Valid shared events are: ${SHARED_HOOK_EVENTS.join(", ")}, plus [claude] and [codex] sections`,
		});
	}

	return {
		sharedConfig,
		providerConfigs: Object.keys(providerConfigs).length > 0 ? providerConfigs : undefined,
		topLevelIssues,
	};
}

function prefixValidationIssues(
	issues: HookValidationResult["errors"],
	sectionLabel: string,
): HookValidationResult["errors"] {
	return issues.map((issue) => ({
		...issue,
		message: `[${sectionLabel}] ${issue.message}`,
		...(issue.suggestion ? { suggestion: `[${sectionLabel}] ${issue.suggestion}` } : {}),
	}));
}

/**
 * Load hooks from a TOML file
 */
function loadTomlHooks(
	capabilityPath: string,
	configPath: string,
	hooksDir: string,
	opts: LoadHooksOptions,
): LoadHooksResult {
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

	const {
		sharedConfig,
		providerConfigs: rawProviderConfigs,
		topLevelIssues,
	} = splitHooksTomlConfig(parsed);

	// Validate
	let validation: HookValidationResult;
	if (opts.validate) {
		const sharedValidation = validateHooksConfig(sharedConfig, {
			basePath: hooksDir,
			checkScripts: opts.checkScripts ?? false,
			allowedEvents: SHARED_HOOK_EVENTS,
			matcherEvents: SHARED_MATCHER_EVENTS,
			promptHookEvents: SHARED_PROMPT_HOOK_EVENTS,
		});

		const providerErrors: HookValidationResult["errors"] = [];
		const providerWarnings: HookValidationResult["warnings"] = [];

		for (const [provider, providerConfig] of Object.entries(rawProviderConfigs ?? {})) {
			const providerEvents = provider === "claude" ? CLAUDE_HOOK_EVENTS : CODEX_HOOK_EVENTS;
			const providerValidationOptions = {
				basePath: hooksDir,
				checkScripts: opts.checkScripts ?? false,
				allowedEvents: providerEvents,
				...(provider === "codex"
					? {
							matcherEvents: CODEX_MATCHER_EVENTS,
							promptHookEvents: CODEX_PROMPT_HOOK_EVENTS,
						}
					: {}),
			};
			const providerValidation = validateHooksConfig(providerConfig, providerValidationOptions);
			providerErrors.push(...prefixValidationIssues(providerValidation.errors, provider));
			providerWarnings.push(...prefixValidationIssues(providerValidation.warnings, provider));
		}

		validation = {
			valid: sharedValidation.valid && topLevelIssues.length === 0 && providerErrors.length === 0,
			errors: [...topLevelIssues, ...sharedValidation.errors, ...providerErrors],
			warnings: [...sharedValidation.warnings, ...providerWarnings],
		};
	} else {
		validation = createEmptyValidationResult();
	}

	// Get config
	let config = validation.valid ? (sharedConfig as HooksConfig) : createEmptyHooksConfig();
	let providerConfigs = validation.valid ? rawProviderConfigs : undefined;

	// Resolve capability root if requested
	if (opts.resolveCapabilityRoot && validation.valid) {
		config = resolveCapabilityRootInConfig(config, capabilityPath);
		if (providerConfigs) {
			providerConfigs = Object.fromEntries(
				Object.entries(providerConfigs).map(([provider, providerConfig]) => [
					provider,
					resolveCapabilityRootInValue(providerConfig, capabilityPath) as Record<string, unknown>,
				]),
			) as ProviderHooksConfig;
		}
	}

	const result: LoadHooksResult = {
		config,
		validation,
		found: true,
		configPath,
	};

	if (providerConfigs) {
		result.providerConfigs = providerConfigs;
	}

	return result;
}

/**
 * Load and merge hooks.json files
 */
function loadJsonHooksFiles(
	capabilityPath: string,
	hooksJsonInDir: string,
	hooksJsonAtRoot: string,
	hooksDir: string,
	opts: LoadHooksOptions,
): LoadHooksResult {
	const configs: HooksConfig[] = [];
	const allErrors: HookValidationResult["errors"] = [];
	const allWarnings: HookValidationResult["warnings"] = [];
	const unknownFieldWarnings: string[] = [];
	let foundPath: string | undefined;

	// Load hooks/hooks.json
	if (existsSync(hooksJsonInDir)) {
		const result = loadHooksJson(hooksJsonInDir);
		if (result.found) {
			foundPath = result.configPath;
			if (result.loadError) {
				allErrors.push(...result.validation.errors);
			} else {
				configs.push(result.config);
				allErrors.push(...result.validation.errors);
				allWarnings.push(...result.validation.warnings);
			}
			unknownFieldWarnings.push(...result.unknownFieldWarnings);
		}
	}

	// Load root hooks.json
	if (existsSync(hooksJsonAtRoot)) {
		const result = loadHooksJson(hooksJsonAtRoot);
		if (result.found) {
			if (!foundPath) {
				foundPath = result.configPath;
			}
			if (result.loadError) {
				allErrors.push(...result.validation.errors);
			} else {
				configs.push(result.config);
				allErrors.push(...result.validation.errors);
				allWarnings.push(...result.validation.warnings);
			}
			unknownFieldWarnings.push(...result.unknownFieldWarnings);
		}
	}

	// Log warnings for unknown fields
	for (const warning of unknownFieldWarnings) {
		console.warn(`[hooks] Warning: ${warning}`);
	}

	// Merge configs
	let mergedConfig = createEmptyHooksConfig();
	if (configs.length > 0) {
		mergedConfig = mergeRawHooksConfigs(configs);
	}

	// Validate merged config if requested
	let validation: HookValidationResult;
	if (opts.validate && allErrors.length === 0) {
		validation = validateHooksConfig(mergedConfig, {
			basePath: hooksDir,
			checkScripts: opts.checkScripts ?? false,
		});
	} else {
		validation = {
			valid: allErrors.length === 0,
			errors: allErrors,
			warnings: allWarnings,
		};
	}

	// Resolve capability root if requested
	if (opts.resolveCapabilityRoot && validation.valid) {
		mergedConfig = resolveCapabilityRootInConfig(mergedConfig, capabilityPath);
	}

	const result: LoadHooksResult = {
		config: validation.valid ? mergedConfig : createEmptyHooksConfig(),
		validation,
		found: true,
	};

	if (foundPath) {
		result.configPath = foundPath;
	}

	return result;
}

/**
 * Merge multiple HooksConfig objects into one
 * Internal helper for merging hooks.json files
 */
function mergeRawHooksConfigs(configs: HooksConfig[]): HooksConfig {
	const result: HooksConfig = {};

	for (const event of HOOK_EVENTS) {
		const allMatchers: HookMatcher[] = [];

		for (const config of configs) {
			const matchers = config[event];
			if (matchers && matchers.length > 0) {
				allMatchers.push(...matchers);
			}
		}

		if (allMatchers.length > 0) {
			result[event] = allMatchers;
		}
	}

	return result;
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
		...(result.providerConfigs ? { providerConfigs: result.providerConfigs } : {}),
		validation: result.validation,
	};
}

/**
 * Check if a capability has hooks defined
 *
 * Checks for hooks in any of these locations:
 * - hooks/hooks.toml (OmniDev format)
 * - hooks/hooks.json (Claude plugin format)
 * - hooks.json (Claude plugin root format)
 */
export function hasHooks(capabilityPath: string): boolean {
	const tomlPath = join(capabilityPath, HOOKS_DIRECTORY, HOOKS_CONFIG_FILENAME);
	const jsonInDir = join(capabilityPath, HOOKS_DIRECTORY, CLAUDE_HOOKS_CONFIG_FILENAME);
	const jsonAtRoot = join(capabilityPath, CLAUDE_HOOKS_CONFIG_FILENAME);

	return existsSync(tomlPath) || existsSync(jsonInDir) || existsSync(jsonAtRoot);
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
