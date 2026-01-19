/**
 * Hook configuration merging
 *
 * Merges hooks from multiple capabilities into a single configuration.
 * Used when generating provider settings from all active capabilities.
 */

import { HOOK_EVENTS } from "./constants.js";
import type { HooksConfig, HookMatcher, CapabilityHooks, HookEvent } from "./types.js";

/**
 * Merge hooks from multiple capabilities into a single HooksConfig.
 *
 * Strategy:
 * - All matchers from all capabilities are collected
 * - Hooks are not deduplicated to preserve execution order and capability-specific behavior
 * - Description field is omitted in merged config (it's per-capability metadata)
 */
export function mergeHooksConfigs(capabilityHooks: CapabilityHooks[]): HooksConfig {
	const result: HooksConfig = {};

	for (const event of HOOK_EVENTS) {
		const allMatchers: HookMatcher[] = [];

		for (const capHooks of capabilityHooks) {
			const matchers = capHooks.config[event];
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
 * Options for deduplication
 */
export interface DeduplicateOptions {
	/** Deduplicate identical commands across matchers (default: false) */
	deduplicateCommands?: boolean;
}

/**
 * Merge and deduplicate hooks from multiple capability hooks.
 *
 * When deduplicateCommands is true:
 * - Commands that are exactly identical are kept only once per event
 * - The first occurrence is kept, subsequent duplicates removed
 *
 * This is useful when multiple capabilities might register the same hook
 * (e.g., a common formatting hook).
 */
export function mergeAndDeduplicateHooks(
	capabilityHooks: CapabilityHooks[],
	options?: DeduplicateOptions,
): HooksConfig {
	const merged = mergeHooksConfigs(capabilityHooks);

	if (!options?.deduplicateCommands) {
		return merged;
	}

	// Deduplicate commands within each event
	const result: HooksConfig = {};

	for (const event of HOOK_EVENTS) {
		const matchers = merged[event];
		if (!matchers || matchers.length === 0) {
			continue;
		}

		const seenCommands = new Set<string>();
		const deduplicatedMatchers: HookMatcher[] = [];

		for (const matcher of matchers) {
			const deduplicatedHooks = matcher.hooks.filter((hook) => {
				if (hook.type !== "command") {
					// Prompt hooks are not deduplicated
					return true;
				}

				const key = hook.command;
				if (seenCommands.has(key)) {
					return false;
				}
				seenCommands.add(key);
				return true;
			});

			// Only include matcher if it has hooks remaining
			if (deduplicatedHooks.length > 0) {
				deduplicatedMatchers.push({
					...matcher,
					hooks: deduplicatedHooks,
				});
			}
		}

		if (deduplicatedMatchers.length > 0) {
			result[event] = deduplicatedMatchers;
		}
	}

	return result;
}

/**
 * Check if a merged config has any hooks defined
 */
export function hasAnyHooks(config: HooksConfig): boolean {
	for (const event of HOOK_EVENTS) {
		const matchers = config[event];
		if (matchers && matchers.length > 0) {
			return true;
		}
	}
	return false;
}

/**
 * Count total number of hook definitions across all events
 */
export function countHooks(config: HooksConfig): number {
	let count = 0;

	for (const event of HOOK_EVENTS) {
		const matchers = config[event];
		if (matchers) {
			for (const matcher of matchers) {
				count += matcher.hooks.length;
			}
		}
	}

	return count;
}

/**
 * Get all events that have hooks defined
 */
export function getEventsWithHooks(config: HooksConfig): HookEvent[] {
	const events: HookEvent[] = [];

	for (const event of HOOK_EVENTS) {
		const matchers = config[event];
		if (matchers && matchers.length > 0) {
			events.push(event);
		}
	}

	return events;
}
