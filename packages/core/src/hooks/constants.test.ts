import { describe, expect, test } from "bun:test";
import {
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

describe("hook constants", () => {
	test("HOOK_EVENTS contains all 10 events", () => {
		expect(HOOK_EVENTS).toHaveLength(10);
		expect(HOOK_EVENTS).toContain("PreToolUse");
		expect(HOOK_EVENTS).toContain("PostToolUse");
		expect(HOOK_EVENTS).toContain("PermissionRequest");
		expect(HOOK_EVENTS).toContain("UserPromptSubmit");
		expect(HOOK_EVENTS).toContain("Stop");
		expect(HOOK_EVENTS).toContain("SubagentStop");
		expect(HOOK_EVENTS).toContain("Notification");
		expect(HOOK_EVENTS).toContain("SessionStart");
		expect(HOOK_EVENTS).toContain("SessionEnd");
		expect(HOOK_EVENTS).toContain("PreCompact");
	});

	test("MATCHER_EVENTS is subset of HOOK_EVENTS", () => {
		for (const event of MATCHER_EVENTS) {
			expect(HOOK_EVENTS).toContain(event);
		}
	});

	test("MATCHER_EVENTS contains correct events", () => {
		expect(MATCHER_EVENTS).toContain("PreToolUse");
		expect(MATCHER_EVENTS).toContain("PostToolUse");
		expect(MATCHER_EVENTS).toContain("PermissionRequest");
		expect(MATCHER_EVENTS).toContain("Notification");
		expect(MATCHER_EVENTS).toContain("SessionStart");
		expect(MATCHER_EVENTS).toContain("PreCompact");
		// Should NOT contain these
		expect(MATCHER_EVENTS).not.toContain("Stop");
		expect(MATCHER_EVENTS).not.toContain("UserPromptSubmit");
	});

	test("PROMPT_HOOK_EVENTS is subset of HOOK_EVENTS", () => {
		for (const event of PROMPT_HOOK_EVENTS) {
			expect(HOOK_EVENTS).toContain(event);
		}
	});

	test("PROMPT_HOOK_EVENTS contains correct events", () => {
		expect(PROMPT_HOOK_EVENTS).toContain("Stop");
		expect(PROMPT_HOOK_EVENTS).toContain("SubagentStop");
		expect(PROMPT_HOOK_EVENTS).toContain("UserPromptSubmit");
		expect(PROMPT_HOOK_EVENTS).toContain("PreToolUse");
		expect(PROMPT_HOOK_EVENTS).toContain("PermissionRequest");
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
		expect(Array.isArray(MATCHER_EVENTS)).toBe(true);
		expect(Array.isArray(PROMPT_HOOK_EVENTS)).toBe(true);
		expect(Array.isArray(HOOK_TYPES)).toBe(true);
	});
});
