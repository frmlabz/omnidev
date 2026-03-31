/**
 * Hooks module
 *
 * Provides types, validation, and loading for capability hooks.
 * Hooks are shell commands or LLM prompts that execute at various
 * points in the AI agent lifecycle.
 */

// Constants
export {
	HOOK_EVENTS,
	MATCHER_EVENTS,
	PROMPT_HOOK_EVENTS,
	HOOK_TYPES,
	COMMON_TOOL_MATCHERS,
	NOTIFICATION_MATCHERS,
	SESSION_START_MATCHERS,
	PRE_COMPACT_MATCHERS,
	DEFAULT_COMMAND_TIMEOUT,
	DEFAULT_PROMPT_TIMEOUT,
	VARIABLE_MAPPINGS,
	HOOKS_CONFIG_FILENAME,
	CLAUDE_HOOKS_CONFIG_FILENAME,
	HOOKS_DIRECTORY,
} from "./constants";

// Types
export type {
	HookEvent,
	HookType,
	HookProviderSection,
	MatcherEvent,
	PromptHookEvent,
	NotificationMatcher,
	SessionStartMatcher,
	PreCompactMatcher,
	OmnidevVariable,
	ClaudeVariable,
	HookCommand,
	HookPrompt,
	Hook,
	HookMatcher,
	HooksConfig,
	ProviderHooksConfig,
	ValidationSeverity,
	HookValidationCode,
	HookValidationIssue,
	HookValidationResult,
	CapabilityHooks,
	DoctorCheckStatus,
	HooksDoctorCheck,
	HooksDoctorResult,
} from "./types";

// Type guards
export {
	isHookCommand,
	isHookPrompt,
	isMatcherEvent,
	isPromptHookEvent,
	isHookEvent,
	isHookType,
} from "./types";

// Validation
export {
	validateHooksConfig,
	validateHook,
	isValidMatcherPattern,
	findDuplicateCommands,
	createEmptyHooksConfig,
	createEmptyValidationResult,
} from "./validation";

// Variable transformation
export {
	transformToOmnidev,
	transformToClaude,
	transformHooksConfig,
	containsClaudeVariables,
	containsOmnidevVariables,
	resolveCapabilityRoot,
	resolveCapabilityRootInValue,
	resolveCapabilityRootInConfig,
} from "./variables";

// Loader
export type { LoadHooksOptions, LoadHooksResult } from "./loader";
export {
	loadHooksFromCapability,
	loadCapabilityHooks,
	hasHooks,
	getHooksDirectory,
	getHooksConfigPath,
} from "./loader";

// Merger
export type { DeduplicateOptions } from "./merger";
export {
	mergeHooksConfigs,
	mergeAndDeduplicateHooks,
	hasAnyHooks,
	countHooks,
	getEventsWithHooks,
} from "./merger";

// Provider composition
export { composeHooksForProvider, hasHooksInConfig } from "./provider-config";

// JSON loader (Claude plugin hooks.json format)
export type { LoadJsonHooksResult } from "./json-loader";
export { loadHooksJson } from "./json-loader";
