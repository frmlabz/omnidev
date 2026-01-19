/**
 * Environment variable transformation
 *
 * Transforms between OmniDev and Claude Code environment variables.
 *
 * When capabilities define hooks, they use OMNIDEV_ prefixed variables.
 * When writing to .claude/settings.json, these are transformed to CLAUDE_ variables.
 * When importing external capabilities, CLAUDE_ variables are transformed to OMNIDEV_.
 */

import { VARIABLE_MAPPINGS } from "./constants.js";
import type { HooksConfig, Hook, HookMatcher } from "./types.js";

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
	const events = [
		"PreToolUse",
		"PostToolUse",
		"PermissionRequest",
		"UserPromptSubmit",
		"Stop",
		"SubagentStop",
		"Notification",
		"SessionStart",
		"SessionEnd",
		"PreCompact",
	] as const;

	for (const event of events) {
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
