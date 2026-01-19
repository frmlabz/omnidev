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
	HOOKS_DIRECTORY,
} from "./constants.js";

// Types
export type {
	HookEvent,
	HookType,
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
	ValidationSeverity,
	HookValidationCode,
	HookValidationIssue,
	HookValidationResult,
	CapabilityHooks,
	DoctorCheckStatus,
	HooksDoctorCheck,
	HooksDoctorResult,
} from "./types.js";

// Type guards
export {
	isHookCommand,
	isHookPrompt,
	isMatcherEvent,
	isPromptHookEvent,
	isHookEvent,
	isHookType,
} from "./types.js";

// Validation
export {
	validateHooksConfig,
	validateHook,
	isValidMatcherPattern,
	findDuplicateCommands,
	createEmptyHooksConfig,
	createEmptyValidationResult,
} from "./validation.js";

// Variable transformation
export {
	transformToOmnidev,
	transformToClaude,
	transformHooksConfig,
	containsClaudeVariables,
	containsOmnidevVariables,
} from "./variables.js";

// Loader
export type { LoadHooksOptions, LoadHooksResult } from "./loader.js";
export {
	loadHooksFromCapability,
	loadCapabilityHooks,
	hasHooks,
	getHooksDirectory,
	getHooksConfigPath,
} from "./loader.js";

// Merger
export type { DeduplicateOptions } from "./merger.js";
export {
	mergeHooksConfigs,
	mergeAndDeduplicateHooks,
	hasAnyHooks,
	countHooks,
	getEventsWithHooks,
} from "./merger.js";
