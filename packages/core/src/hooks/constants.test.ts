import { describe, expect, test } from "bun:test";
import {
	SHARED_HOOK_EVENTS,
	CLAUDE_HOOK_EVENTS,
	CODEX_HOOK_EVENTS,
	HOOK_EVENTS,
	SHARED_MATCHER_EVENTS,
	CLAUDE_MATCHER_EVENTS,
	CODEX_MATCHER_EVENTS,
	MATCHER_EVENTS,
	SHARED_PROMPT_HOOK_EVENTS,
	CLAUDE_PROMPT_HOOK_EVENTS,
	CODEX_PROMPT_HOOK_EVENTS,
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
} from "./constants";

describe("hook constants", () => {
	test("shared hook events contain the portable top-level subset", () => {
		expect(SHARED_HOOK_EVENTS).toHaveLength(10);
		expect(SHARED_HOOK_EVENTS).toContain("PreToolUse");
		expect(SHARED_HOOK_EVENTS).toContain("PostToolUse");
		expect(SHARED_HOOK_EVENTS).toContain("PermissionRequest");
		expect(SHARED_HOOK_EVENTS).toContain("UserPromptSubmit");
		expect(SHARED_HOOK_EVENTS).toContain("Stop");
		expect(SHARED_HOOK_EVENTS).toContain("SubagentStop");
		expect(SHARED_HOOK_EVENTS).toContain("Notification");
		expect(SHARED_HOOK_EVENTS).toContain("SessionStart");
		expect(SHARED_HOOK_EVENTS).toContain("SessionEnd");
		expect(SHARED_HOOK_EVENTS).toContain("PreCompact");
	});

	test("HOOK_EVENTS contains the full Claude event surface", () => {
		expect(HOOK_EVENTS).toEqual(CLAUDE_HOOK_EVENTS);
		expect(HOOK_EVENTS).toContain("WorktreeCreate");
		expect(HOOK_EVENTS).toContain("WorktreeRemove");
		expect(HOOK_EVENTS).toContain("PermissionDenied");
		expect(HOOK_EVENTS).toContain("PostToolUseFailure");
		expect(HOOK_EVENTS).toContain("PostCompact");
	});

	test("codex hook events contain the supported subset", () => {
		expect(CODEX_HOOK_EVENTS).toEqual([
			"SessionStart",
			"PreToolUse",
			"PostToolUse",
			"UserPromptSubmit",
			"Stop",
		]);
	});

	test("matcher event groups are subsets of their parent event groups", () => {
		for (const event of SHARED_MATCHER_EVENTS) {
			expect(SHARED_HOOK_EVENTS).toContain(event);
		}
		for (const event of CLAUDE_MATCHER_EVENTS) {
			expect(CLAUDE_HOOK_EVENTS).toContain(event);
		}
		for (const event of CODEX_MATCHER_EVENTS) {
			expect(CODEX_HOOK_EVENTS).toContain(event);
		}
	});

	test("MATCHER_EVENTS contains Claude matcher-capable events", () => {
		expect(MATCHER_EVENTS).toEqual(CLAUDE_MATCHER_EVENTS);
		expect(MATCHER_EVENTS).toContain("FileChanged");
		expect(MATCHER_EVENTS).toContain("InstructionsLoaded");
		expect(MATCHER_EVENTS).not.toContain("WorktreeRemove");
	});

	test("prompt event groups are subsets of their parent event groups", () => {
		for (const event of SHARED_PROMPT_HOOK_EVENTS) {
			expect(SHARED_HOOK_EVENTS).toContain(event);
		}
		for (const event of CLAUDE_PROMPT_HOOK_EVENTS) {
			expect(CLAUDE_HOOK_EVENTS).toContain(event);
		}
		expect(CODEX_PROMPT_HOOK_EVENTS).toEqual([]);
	});

	test("PROMPT_HOOK_EVENTS contains Claude prompt-capable events", () => {
		expect(PROMPT_HOOK_EVENTS).toEqual(CLAUDE_PROMPT_HOOK_EVENTS);
		expect(PROMPT_HOOK_EVENTS).toContain("PostToolUse");
		expect(PROMPT_HOOK_EVENTS).toContain("TaskCreated");
		expect(PROMPT_HOOK_EVENTS).not.toContain("WorktreeCreate");
	});

	test("HOOK_TYPES contains command and prompt", () => {
		expect(HOOK_TYPES).toHaveLength(2);
		expect(HOOK_TYPES).toContain("command");
		expect(HOOK_TYPES).toContain("prompt");
	});

	test("COMMON_TOOL_MATCHERS contains expected tools", () => {
		expect(COMMON_TOOL_MATCHERS).toContain("Bash");
		expect(COMMON_TOOL_MATCHERS).toContain("Read");
		expect(COMMON_TOOL_MATCHERS).toContain("Write");
		expect(COMMON_TOOL_MATCHERS).toContain("Edit");
	});

	test("NOTIFICATION_MATCHERS contains expected types", () => {
		expect(NOTIFICATION_MATCHERS).toContain("permission_prompt");
		expect(NOTIFICATION_MATCHERS).toContain("idle_prompt");
		expect(NOTIFICATION_MATCHERS).toContain("auth_success");
		expect(NOTIFICATION_MATCHERS).toContain("elicitation_dialog");
	});

	test("SESSION_START_MATCHERS contains expected types", () => {
		expect(SESSION_START_MATCHERS).toContain("startup");
		expect(SESSION_START_MATCHERS).toContain("resume");
		expect(SESSION_START_MATCHERS).toContain("clear");
		expect(SESSION_START_MATCHERS).toContain("compact");
	});

	test("PRE_COMPACT_MATCHERS contains expected types", () => {
		expect(PRE_COMPACT_MATCHERS).toContain("manual");
		expect(PRE_COMPACT_MATCHERS).toContain("auto");
	});

	test("DEFAULT_COMMAND_TIMEOUT is 60 seconds", () => {
		expect(DEFAULT_COMMAND_TIMEOUT).toBe(60);
	});

	test("DEFAULT_PROMPT_TIMEOUT is 30 seconds", () => {
		expect(DEFAULT_PROMPT_TIMEOUT).toBe(30);
	});

	test("VARIABLE_MAPPINGS has correct keys", () => {
		expect(VARIABLE_MAPPINGS.OMNIDEV_CAPABILITY_ROOT).toBe("CLAUDE_PLUGIN_ROOT");
		expect(VARIABLE_MAPPINGS.OMNIDEV_PROJECT_DIR).toBe("CLAUDE_PROJECT_DIR");
	});

	test("HOOKS_CONFIG_FILENAME is hooks.toml", () => {
		expect(HOOKS_CONFIG_FILENAME).toBe("hooks.toml");
	});

	test("HOOKS_DIRECTORY is hooks", () => {
		expect(HOOKS_DIRECTORY).toBe("hooks");
	});

	test("all constants are readonly", () => {
		// These should be readonly tuples, not mutable arrays
		// TypeScript prevents mutation at compile time, but we can verify they're arrays
		expect(Array.isArray(HOOK_EVENTS)).toBe(true);
		expect(Array.isArray(SHARED_HOOK_EVENTS)).toBe(true);
		expect(Array.isArray(MATCHER_EVENTS)).toBe(true);
		expect(Array.isArray(SHARED_MATCHER_EVENTS)).toBe(true);
		expect(Array.isArray(PROMPT_HOOK_EVENTS)).toBe(true);
		expect(Array.isArray(SHARED_PROMPT_HOOK_EVENTS)).toBe(true);
		expect(Array.isArray(HOOK_TYPES)).toBe(true);
	});
});
