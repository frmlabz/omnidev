import type { CanonicalProviderId } from "#providers";
import { HOOK_EVENTS } from "./constants";
import type {
	CapabilityHooks,
	HooksConfig,
	HookMatcher,
	HookProviderSection,
	ProviderHooksConfig,
} from "./types";

const CODEX_SUPPORTED_EVENTS = new Set([
	"SessionStart",
	"PreToolUse",
	"PostToolUse",
	"UserPromptSubmit",
	"Stop",
]);

const PROVIDER_SECTION_BY_ID = {
	"claude-code": "claude",
	codex: "codex",
} as const satisfies Partial<Record<CanonicalProviderId, HookProviderSection>>;

function getProviderDisplayName(providerId: CanonicalProviderId): string {
	switch (providerId) {
		case "claude-code":
			return "Claude Code";
		case "codex":
			return "Codex";
		case "cursor":
			return "Cursor";
		case "opencode":
			return "OpenCode";
	}
}

function hasOwnKey(value: object, key: string): boolean {
	return Object.hasOwn(value, key);
}

export function hasHooksInConfig(config: Record<string, unknown> | undefined): boolean {
	if (!config) {
		return false;
	}

	for (const event of HOOK_EVENTS) {
		const matchers = config[event];
		if (Array.isArray(matchers) && matchers.length > 0) {
			return true;
		}
	}

	return false;
}

function matcherMatchesAny(matcher: string | undefined, values: string[]): boolean {
	if (matcher === undefined || matcher === "" || matcher === "*") {
		return true;
	}

	try {
		const regex = new RegExp(matcher);
		return values.some((value) => regex.test(value));
	} catch {
		return false;
	}
}

function cloneMatcher(matcher: HookMatcher): HookMatcher {
	return {
		...(matcher.matcher !== undefined ? { matcher: matcher.matcher } : {}),
		hooks: matcher.hooks.map((hook) => ({ ...hook })),
	};
}

function filterSharedHooksForCodex(
	config: HooksConfig,
	capabilityName: string,
): { config: HooksConfig; warnings: string[] } {
	const warnings: string[] = [];

	if (process.platform === "win32") {
		if (hasHooksInConfig(config as Record<string, unknown>)) {
			warnings.push(
				`[hooks] Warning: Capability "${capabilityName}" has shared hooks, but Codex hooks are currently disabled on Windows. Skipping Codex hook output.`,
			);
		}
		return { config: {}, warnings };
	}

	const filtered: HooksConfig = {};

	for (const event of HOOK_EVENTS) {
		const matchers = config[event];
		if (!matchers || matchers.length === 0) {
			continue;
		}

		if (!CODEX_SUPPORTED_EVENTS.has(event)) {
			warnings.push(
				`[hooks] Warning: Capability "${capabilityName}" shared event "${event}" is not supported by Codex and was skipped.`,
			);
			continue;
		}

		const filteredMatchers: HookMatcher[] = [];

		for (const matcher of matchers) {
			const nextMatcher = cloneMatcher(matcher);
			const originalHookCount = nextMatcher.hooks.length;
			nextMatcher.hooks = nextMatcher.hooks.filter((hook, hookIndex) => {
				if (hook.type === "command") {
					return true;
				}

				warnings.push(
					`[hooks] Warning: Capability "${capabilityName}" shared ${event} hook ${hookIndex + 1} uses prompt hooks, which Codex does not support. It was skipped.`,
				);
				return false;
			});

			if (nextMatcher.hooks.length === 0) {
				continue;
			}

			if (event === "UserPromptSubmit" || event === "Stop") {
				if (
					nextMatcher.matcher !== undefined &&
					nextMatcher.matcher !== "" &&
					nextMatcher.matcher !== "*"
				) {
					warnings.push(
						`[hooks] Warning: Capability "${capabilityName}" shared ${event} matcher "${nextMatcher.matcher}" is ignored by Codex. The matcher was dropped.`,
					);
					delete nextMatcher.matcher;
				}
				filteredMatchers.push(nextMatcher);
				continue;
			}

			if (event === "PreToolUse" || event === "PostToolUse") {
				if (!matcherMatchesAny(nextMatcher.matcher, ["Bash"])) {
					warnings.push(
						`[hooks] Warning: Capability "${capabilityName}" shared ${event} matcher "${nextMatcher.matcher ?? ""}" does not match Codex's current tool runtime ("Bash") and was skipped.`,
					);
					continue;
				}
				filteredMatchers.push(nextMatcher);
				continue;
			}

			if (event === "SessionStart") {
				if (!matcherMatchesAny(nextMatcher.matcher, ["startup", "resume"])) {
					warnings.push(
						`[hooks] Warning: Capability "${capabilityName}" shared SessionStart matcher "${nextMatcher.matcher ?? ""}" does not match Codex's current sources ("startup" or "resume") and was skipped.`,
					);
					continue;
				}
			}

			if (
				nextMatcher.hooks.length !== originalHookCount ||
				nextMatcher.matcher !== matcher.matcher
			) {
				filteredMatchers.push(nextMatcher);
			} else {
				filteredMatchers.push(matcher);
			}
		}

		if (filteredMatchers.length > 0) {
			filtered[event] = filteredMatchers;
		}
	}

	return { config: filtered, warnings };
}

function getProviderOverrideWarnings(
	providerId: CanonicalProviderId,
	capabilityName: string,
	providerConfigs: ProviderHooksConfig | undefined,
): string[] {
	if (!providerConfigs) {
		return [];
	}

	if (providerId === "claude-code" && providerConfigs.codex) {
		return [
			`[hooks] Warning: Capability "${capabilityName}" defines [codex] hooks; they are not used by Claude Code.`,
		];
	}

	if (providerId === "codex" && providerConfigs.claude) {
		return [
			`[hooks] Warning: Capability "${capabilityName}" defines [claude] hooks; they are not used by Codex.`,
		];
	}

	return [];
}

function applyProviderOverrides(
	baseConfig: Record<string, unknown>,
	providerId: CanonicalProviderId,
	capabilityName: string,
	providerConfigs: ProviderHooksConfig | undefined,
): { config: Record<string, unknown>; warnings: string[] } {
	const warnings = getProviderOverrideWarnings(providerId, capabilityName, providerConfigs);
	const providerSection = PROVIDER_SECTION_BY_ID[providerId as keyof typeof PROVIDER_SECTION_BY_ID];

	if (!providerSection) {
		return { config: baseConfig, warnings };
	}

	const overrideConfig = providerConfigs?.[providerSection];
	if (!overrideConfig) {
		return { config: baseConfig, warnings };
	}

	const result: Record<string, unknown> = { ...baseConfig };

	for (const event of HOOK_EVENTS) {
		if (!hasOwnKey(overrideConfig, event)) {
			continue;
		}

		const eventValue = overrideConfig[event];
		if (!Array.isArray(eventValue)) {
			warnings.push(
				`[hooks] Warning: Capability "${capabilityName}" [${providerSection}].${event} must be an array to be emitted for ${getProviderDisplayName(providerId)}. The override was skipped.`,
			);
			continue;
		}

		result[event] = eventValue;
	}

	return { config: result, warnings };
}

function mergeCapabilityHookConfig(
	target: Record<string, unknown>,
	capabilityConfig: Record<string, unknown>,
): void {
	for (const event of HOOK_EVENTS) {
		const eventValue = capabilityConfig[event];
		if (!Array.isArray(eventValue) || eventValue.length === 0) {
			continue;
		}

		const existing = target[event];
		target[event] = Array.isArray(existing) ? [...existing, ...eventValue] : [...eventValue];
	}
}

export function composeHooksForProvider(
	capabilityHooks: CapabilityHooks[],
	providerId: CanonicalProviderId,
): { config: HooksConfig; warnings: string[] } {
	if (providerId !== "claude-code" && providerId !== "codex") {
		return { config: {}, warnings: [] };
	}

	const warnings: string[] = [];
	const mergedConfig: Record<string, unknown> = {};

	for (const capHooks of capabilityHooks) {
		if (providerId === "codex" && process.platform === "win32") {
			if (
				hasHooksInConfig(capHooks.config as Record<string, unknown>) ||
				hasHooksInConfig(capHooks.providerConfigs?.codex)
			) {
				warnings.push(
					`[hooks] Warning: Capability "${capHooks.capabilityName}" has Codex hooks configured, but Codex hooks are currently disabled on Windows. Skipping Codex hook output.`,
				);
			}
			continue;
		}

		let capabilityConfig: HooksConfig = capHooks.config;

		if (providerId === "codex") {
			const filtered = filterSharedHooksForCodex(capabilityConfig, capHooks.capabilityName);
			capabilityConfig = filtered.config;
			warnings.push(...filtered.warnings);
		}

		const withOverrides = applyProviderOverrides(
			capabilityConfig as Record<string, unknown>,
			providerId,
			capHooks.capabilityName,
			capHooks.providerConfigs,
		);
		warnings.push(...withOverrides.warnings);
		mergeCapabilityHookConfig(mergedConfig, withOverrides.config);
	}

	return {
		config: mergedConfig as HooksConfig,
		warnings,
	};
}
