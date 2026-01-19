/**
 * Hook system types
 *
 * Provides TypeScript types for the hooks configuration system,
 * including validation result types and type guards.
 */

import {
	HOOK_EVENTS,
	HOOK_TYPES,
	MATCHER_EVENTS,
	PROMPT_HOOK_EVENTS,
	type NOTIFICATION_MATCHERS,
	type SESSION_START_MATCHERS,
	type PRE_COMPACT_MATCHERS,
	type VARIABLE_MAPPINGS,
} from "./constants.js";

// ============ Core Type Derivations ============

/** All supported hook event names */
export type HookEvent = (typeof HOOK_EVENTS)[number];

/** Hook execution types: command or prompt */
export type HookType = (typeof HOOK_TYPES)[number];

/** Events that support matcher patterns */
export type MatcherEvent = (typeof MATCHER_EVENTS)[number];

/** Events that support prompt-type hooks */
export type PromptHookEvent = (typeof PROMPT_HOOK_EVENTS)[number];

// Matcher types for specific events
export type NotificationMatcher = (typeof NOTIFICATION_MATCHERS)[number];
export type SessionStartMatcher = (typeof SESSION_START_MATCHERS)[number];
export type PreCompactMatcher = (typeof PRE_COMPACT_MATCHERS)[number];

// Variable types
export type OmnidevVariable = keyof typeof VARIABLE_MAPPINGS;
export type ClaudeVariable = (typeof VARIABLE_MAPPINGS)[OmnidevVariable];

// ============ Hook Definitions ============

/** Command-type hook that executes a shell command */
export interface HookCommand {
	type: "command";
	/** Shell command to execute */
	command: string;
	/** Timeout in seconds (default: 60) */
	timeout?: number;
}

/** Prompt-type hook that uses LLM evaluation */
export interface HookPrompt {
	type: "prompt";
	/** Prompt text to send to LLM (use $ARGUMENTS for input) */
	prompt: string;
	/** Timeout in seconds (default: 30) */
	timeout?: number;
}

/** Union of all hook types */
export type Hook = HookCommand | HookPrompt;

/** Hook matcher entry - groups hooks by matcher pattern */
export interface HookMatcher {
	/**
	 * Regex pattern to match tool/event names
	 * - Use "*" or "" to match all
	 * - Supports regex: "Edit|Write", "Bash.*"
	 */
	matcher?: string;
	/** Array of hooks to execute when pattern matches */
	hooks: Hook[];
}

// ============ Configuration Structure ============

/** Full hooks configuration from hooks.toml */
export interface HooksConfig {
	/** Optional description of the hooks */
	description?: string;

	// Events with matchers
	PreToolUse?: HookMatcher[];
	PostToolUse?: HookMatcher[];
	PermissionRequest?: HookMatcher[];
	Notification?: HookMatcher[];
	SessionStart?: HookMatcher[];
	PreCompact?: HookMatcher[];

	// Events without matchers (matcher field ignored if present)
	UserPromptSubmit?: HookMatcher[];
	Stop?: HookMatcher[];
	SubagentStop?: HookMatcher[];
	SessionEnd?: HookMatcher[];
}

// ============ Validation Types ============

export type ValidationSeverity = "error" | "warning";

/** Validation error codes for consistent reporting */
export type HookValidationCode =
	| "HOOKS_INVALID_TOML"
	| "HOOKS_UNKNOWN_EVENT"
	| "HOOKS_INVALID_TYPE"
	| "HOOKS_PROMPT_NOT_ALLOWED"
	| "HOOKS_MISSING_COMMAND"
	| "HOOKS_MISSING_PROMPT"
	| "HOOKS_INVALID_TIMEOUT"
	| "HOOKS_INVALID_MATCHER"
	| "HOOKS_SCRIPT_NOT_FOUND"
	| "HOOKS_SCRIPT_NOT_EXECUTABLE"
	| "HOOKS_CLAUDE_VARIABLE"
	| "HOOKS_EMPTY_ARRAY"
	| "HOOKS_DUPLICATE_COMMAND"
	| "HOOKS_INVALID_HOOKS_ARRAY";

export interface HookValidationIssue {
	severity: ValidationSeverity;
	/** Validation error code */
	code: HookValidationCode;
	/** Which event the issue is in */
	event?: HookEvent;
	/** Which matcher index (0-based) */
	matcherIndex?: number;
	/** Which hook index within the matcher (0-based) */
	hookIndex?: number;
	/** Human-readable error message */
	message: string;
	/** File path if applicable (for script validation) */
	path?: string;
	/** Suggestion for fixing the issue */
	suggestion?: string;
}

export interface HookValidationResult {
	valid: boolean;
	errors: HookValidationIssue[];
	warnings: HookValidationIssue[];
}

// ============ Capability Integration ============

// TODO: Add programmatic export support for hooks in CapabilityExport interface
// This would allow capabilities to define hooks in index.ts alongside other exports

/** Hooks metadata attached to a capability */
export interface CapabilityHooks {
	/** Source capability name */
	capabilityName: string;
	/** Source capability path */
	capabilityPath: string;
	/** The hooks configuration */
	config: HooksConfig;
	/** Validation result */
	validation: HookValidationResult;
}

// ============ Doctor Types ============

export type DoctorCheckStatus = "pass" | "fail" | "warn";

export interface HooksDoctorCheck {
	name: string;
	status: DoctorCheckStatus;
	message: string;
	details?: string[];
}

export interface HooksDoctorResult {
	checks: HooksDoctorCheck[];
	summary: {
		total: number;
		passed: number;
		failed: number;
		warnings: number;
	};
}

// ============ Type Guards ============

/** Check if a hook is a command hook */
export function isHookCommand(hook: Hook): hook is HookCommand {
	return hook.type === "command";
}

/** Check if a hook is a prompt hook */
export function isHookPrompt(hook: Hook): hook is HookPrompt {
	return hook.type === "prompt";
}

/** Check if an event supports matchers */
export function isMatcherEvent(event: string): event is MatcherEvent {
	return (MATCHER_EVENTS as readonly string[]).includes(event);
}

/** Check if an event supports prompt-type hooks */
export function isPromptHookEvent(event: string): event is PromptHookEvent {
	return (PROMPT_HOOK_EVENTS as readonly string[]).includes(event);
}

/** Check if a string is a valid hook event */
export function isHookEvent(event: string): event is HookEvent {
	return (HOOK_EVENTS as readonly string[]).includes(event);
}

/** Check if a string is a valid hook type */
export function isHookType(type: string): type is HookType {
	return (HOOK_TYPES as readonly string[]).includes(type);
}
