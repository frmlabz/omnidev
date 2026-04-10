/**
 * Hook system constants
 *
 * All constants are defined as readonly arrays/objects to enable
 * TypeScript literal type inference.
 */

/** Shared top-level hook events supported directly in hooks.toml */
export const SHARED_HOOK_EVENTS = [
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

/** Claude hook events supported in [claude] provider sections and hooks.json */
export const CLAUDE_HOOK_EVENTS = [
	...SHARED_HOOK_EVENTS,
	"PermissionDenied",
	"PostToolUseFailure",
	"SubagentStart",
	"TaskCreated",
	"TaskCompleted",
	"StopFailure",
	"TeammateIdle",
	"InstructionsLoaded",
	"ConfigChange",
	"CwdChanged",
	"FileChanged",
	"WorktreeCreate",
	"WorktreeRemove",
	"PostCompact",
	"Elicitation",
	"ElicitationResult",
] as const;

/** All known hook events */
export const HOOK_EVENTS = CLAUDE_HOOK_EVENTS;

/** Codex hook events supported in [codex] provider sections */
export const CODEX_HOOK_EVENTS = [
	"SessionStart",
	"PreToolUse",
	"PostToolUse",
	"UserPromptSubmit",
	"Stop",
] as const;

/** Codex events that currently support matchers */
export const CODEX_MATCHER_EVENTS = ["PreToolUse", "PostToolUse", "SessionStart"] as const;

/** Shared top-level events that support matchers */
export const SHARED_MATCHER_EVENTS = [
	"PreToolUse",
	"PostToolUse",
	"PermissionRequest",
	"Notification",
	"SubagentStop",
	"SessionStart",
	"SessionEnd",
	"PreCompact",
] as const;

/** Claude events that support matchers */
export const CLAUDE_MATCHER_EVENTS = [
	...SHARED_MATCHER_EVENTS,
	"PermissionDenied",
	"PostToolUseFailure",
	"SubagentStart",
	"PostCompact",
	"ConfigChange",
	"FileChanged",
	"StopFailure",
	"InstructionsLoaded",
	"Elicitation",
	"ElicitationResult",
] as const;

/** Events that support matchers (Claude/global view) */
export const MATCHER_EVENTS = CLAUDE_MATCHER_EVENTS;

/** Shared top-level events that support prompt-type hooks */
export const SHARED_PROMPT_HOOK_EVENTS = [
	"Stop",
	"SubagentStop",
	"UserPromptSubmit",
	"PreToolUse",
	"PostToolUse",
	"PermissionRequest",
] as const;

/** Claude events that support prompt-type hooks */
export const CLAUDE_PROMPT_HOOK_EVENTS = [
	...SHARED_PROMPT_HOOK_EVENTS,
	"PostToolUseFailure",
	"TaskCreated",
	"TaskCompleted",
] as const;

/** Events that support prompt-type hooks (Claude/global view) */
export const PROMPT_HOOK_EVENTS = CLAUDE_PROMPT_HOOK_EVENTS;

/** Codex does not support prompt hooks today */
export const CODEX_PROMPT_HOOK_EVENTS = [] as const;

/** Hook execution types */
export const HOOK_TYPES = ["command", "prompt"] as const;

/**
 * Common tool matchers (for validation hints, not exhaustive)
 * These are the tools available in Claude Code that hooks commonly target.
 */
export const COMMON_TOOL_MATCHERS = [
	"Bash",
	"Read",
	"Write",
	"Edit",
	"Glob",
	"Grep",
	"Task",
	"WebFetch",
	"WebSearch",
	"NotebookEdit",
	"LSP",
	"TodoWrite",
	"AskUserQuestion",
] as const;

/** Notification type matchers */
export const NOTIFICATION_MATCHERS = [
	"permission_prompt",
	"idle_prompt",
	"auth_success",
	"elicitation_dialog",
] as const;

/** SessionStart source matchers */
export const SESSION_START_MATCHERS = ["startup", "resume", "clear", "compact"] as const;

/** PreCompact trigger matchers */
export const PRE_COMPACT_MATCHERS = ["manual", "auto"] as const;

/** Default timeout for command hooks (in seconds) */
export const DEFAULT_COMMAND_TIMEOUT = 60;

/** Default timeout for prompt hooks (in seconds) */
export const DEFAULT_PROMPT_TIMEOUT = 30;

/**
 * Environment variable mappings between OmniDev and Claude Code
 *
 * When capabilities define hooks, they use OMNIDEV_ prefixed variables.
 * When writing to .claude/settings.json, these are transformed to CLAUDE_ variables.
 * When importing external capabilities, CLAUDE_ variables are transformed to OMNIDEV_.
 */
export const VARIABLE_MAPPINGS = {
	OMNIDEV_CAPABILITY_ROOT: "CLAUDE_PLUGIN_ROOT",
	OMNIDEV_PROJECT_DIR: "CLAUDE_PROJECT_DIR",
} as const;

/** The hooks configuration filename within a capability (OmniDev format) */
export const HOOKS_CONFIG_FILENAME = "hooks.toml";

/** The Claude hooks configuration filename (JSON format) */
export const CLAUDE_HOOKS_CONFIG_FILENAME = "hooks.json";

/** The hooks directory name within a capability */
export const HOOKS_DIRECTORY = "hooks";
