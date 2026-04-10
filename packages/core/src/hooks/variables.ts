/**
 * Environment variable transformation
 *
 * Transforms between OmniDev and Claude Code environment variables.
 *
 * When capabilities define hooks, they use OMNIDEV_ prefixed variables.
 * When writing to .claude/settings.json, these are transformed to CLAUDE_ variables.
 * When importing external capabilities, CLAUDE_ variables are transformed to OMNIDEV_.
 */

import { HOOK_EVENTS, VARIABLE_MAPPINGS } from "./constants";
import type { HooksConfig, Hook, HookMatcher } from "./types";

// Build reverse mapping (Claude -> OmniDev)
const REVERSE_MAPPINGS = Object.fromEntries(
	Object.entries(VARIABLE_MAPPINGS).map(([omni, claude]) => [claude, omni]),
) as Record<string, string>;

/**
 * Transform Claude Code variables to OmniDev format
 * Used when: importing/wrapping external capabilities
 *
 * CLAUDE_PLUGIN_ROOT -> OMNIDEV_CAPABILITY_ROOT
 * CLAUDE_PROJECT_DIR -> OMNIDEV_PROJECT_DIR
 */
export function transformToOmnidev(content: string): string {
	let result = content;

	for (const [claude, omni] of Object.entries(REVERSE_MAPPINGS)) {
		// Handle ${VAR} format
		result = result.replace(new RegExp(`\\$\\{${claude}\\}`, "g"), `\${${omni}}`);
		// Handle $VAR format (not followed by alphanumeric or underscore)
		result = result.replace(new RegExp(`\\$${claude}(?![A-Za-z0-9_])`, "g"), `$${omni}`);
	}

	return result;
}

/**
 * Transform OmniDev variables to Claude Code format
 * Used when: writing to .claude/settings.json
 *
 * OMNIDEV_CAPABILITY_ROOT -> CLAUDE_PLUGIN_ROOT
 * OMNIDEV_PROJECT_DIR -> CLAUDE_PROJECT_DIR
 */
export function transformToClaude(content: string): string {
	let result = content;

	for (const [omni, claude] of Object.entries(VARIABLE_MAPPINGS)) {
		// Handle ${VAR} format
		result = result.replace(new RegExp(`\\$\\{${omni}\\}`, "g"), `\${${claude}}`);
		// Handle $VAR format (not followed by alphanumeric or underscore)
		result = result.replace(new RegExp(`\\$${omni}(?![A-Za-z0-9_])`, "g"), `$${claude}`);
	}

	return result;
}

/**
 * Transform a single hook's variables
 */
function transformHook(hook: Hook, direction: "toOmnidev" | "toClaude"): Hook {
	const transform = direction === "toOmnidev" ? transformToOmnidev : transformToClaude;

	if (hook.type === "command") {
		return {
			...hook,
			command: transform(hook.command),
		};
	}

	if (hook.type === "prompt") {
		return {
			...hook,
			prompt: transform(hook.prompt),
		};
	}

	return hook;
}

/**
 * Transform a matcher's hooks
 */
function transformMatcher(matcher: HookMatcher, direction: "toOmnidev" | "toClaude"): HookMatcher {
	return {
		...matcher,
		hooks: matcher.hooks.map((hook) => transformHook(hook, direction)),
	};
}

/**
 * Transform all variables in a HooksConfig
 */
export function transformHooksConfig(
	config: HooksConfig,
	direction: "toOmnidev" | "toClaude",
): HooksConfig {
	const result: HooksConfig = {};

	if (config.description !== undefined) {
		result.description = config.description;
	}

	// Transform each event's matchers
	for (const event of HOOK_EVENTS) {
		const matchers = config[event];
		if (matchers) {
			result[event] = matchers.map((m) => transformMatcher(m, direction));
		}
	}

	return result;
}

/**
 * Check if a string contains any Claude variables
 */
export function containsClaudeVariables(content: string): boolean {
	for (const claude of Object.values(VARIABLE_MAPPINGS)) {
		if (content.includes(`\${${claude}}`) || content.includes(`$${claude}`)) {
			return true;
		}
	}
	return false;
}

/**
 * Check if a string contains any OmniDev variables
 */
export function containsOmnidevVariables(content: string): boolean {
	for (const omni of Object.keys(VARIABLE_MAPPINGS)) {
		if (content.includes(`\${${omni}}`) || content.includes(`$${omni}`)) {
			return true;
		}
	}
	return false;
}

/**
 * Resolve capability root variable to actual path
 *
 * Replaces ${OMNIDEV_CAPABILITY_ROOT} and ${CLAUDE_PLUGIN_ROOT} with the actual capability path.
 * Used during hook loading when the capability path is known.
 *
 * @param content - String containing variable references
 * @param capabilityPath - The actual absolute path to the capability
 * @returns String with variables replaced by the actual path
 */
export function resolveCapabilityRoot(content: string, capabilityPath: string): string {
	let result = content;

	// Resolve both OMNIDEV_CAPABILITY_ROOT and CLAUDE_PLUGIN_ROOT
	const variables = ["OMNIDEV_CAPABILITY_ROOT", "CLAUDE_PLUGIN_ROOT"];

	for (const varName of variables) {
		// Handle ${VAR} format
		result = result.replace(new RegExp(`\\$\\{${varName}\\}`, "g"), capabilityPath);
		// Handle $VAR format (not followed by alphanumeric or underscore)
		result = result.replace(new RegExp(`\\$${varName}(?![A-Za-z0-9_])`, "g"), capabilityPath);
	}

	return result;
}

/**
 * Recursively resolve capability-root variables in unknown TOML/JSON-like values.
 */
export function resolveCapabilityRootInValue(value: unknown, capabilityPath: string): unknown {
	if (typeof value === "string") {
		return resolveCapabilityRoot(value, capabilityPath);
	}

	if (Array.isArray(value)) {
		return value.map((entry) => resolveCapabilityRootInValue(entry, capabilityPath));
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				resolveCapabilityRootInValue(entry, capabilityPath),
			]),
		);
	}

	return value;
}

/**
 * Resolve capability root in all hooks within a HooksConfig
 *
 * @param config - The hooks configuration
 * @param capabilityPath - The actual absolute path to the capability
 * @returns New HooksConfig with resolved paths
 */
export function resolveCapabilityRootInConfig(
	config: HooksConfig,
	capabilityPath: string,
): HooksConfig {
	return resolveCapabilityRootInValue(config, capabilityPath) as HooksConfig;
}
