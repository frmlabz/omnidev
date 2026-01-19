/**
 * Hook system constants
 *
 * All constants are defined as readonly arrays/objects to enable
 * TypeScript literal type inference.
 */

/** All supported hook events */
export const HOOK_EVENTS = [
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

/** Events that support matchers (regex patterns to filter tool names) */
export const MATCHER_EVENTS = [
	"PreToolUse",
	"PostToolUse",
	"PermissionRequest",
	"Notification",
	"SessionStart",
	"PreCompact",
] as const;

/** Events that support prompt-type hooks (LLM evaluation) */
export const PROMPT_HOOK_EVENTS = [
	"Stop",
	"SubagentStop",
	"UserPromptSubmit",
	"PreToolUse",
	"PermissionRequest",
] as const;

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

/** The hooks configuration filename within a capability */
export const HOOKS_CONFIG_FILENAME = "hooks.toml";

/** The hooks directory name within a capability */
export const HOOKS_DIRECTORY = "hooks";
