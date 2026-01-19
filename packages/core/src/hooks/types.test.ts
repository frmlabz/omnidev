import { describe, expect, test } from "bun:test";
import {
	isHookCommand,
	isHookPrompt,
	isMatcherEvent,
	isPromptHookEvent,
	isHookEvent,
	isHookType,
} from "./types.js";
import type { Hook } from "./types.js";

describe("hook type guards", () => {
	describe("isHookCommand", () => {
		test("returns true for command hooks", () => {
			const hook: Hook = { type: "command", command: "echo hello" };
			expect(isHookCommand(hook)).toBe(true);
		});

		test("returns false for prompt hooks", () => {
			const hook: Hook = { type: "prompt", prompt: "Check if task is done" };
			expect(isHookCommand(hook)).toBe(false);
		});

		test("narrows type correctly", () => {
			const hook: Hook = { type: "command", command: "echo hello", timeout: 30 };
			if (isHookCommand(hook)) {
				// TypeScript should know this is HookCommand
				expect(hook.command).toBe("echo hello");
				expect(hook.timeout).toBe(30);
			}
		});
	});

	describe("isHookPrompt", () => {
		test("returns true for prompt hooks", () => {
			const hook: Hook = { type: "prompt", prompt: "Check if task is done" };
			expect(isHookPrompt(hook)).toBe(true);
		});

		test("returns false for command hooks", () => {
			const hook: Hook = { type: "command", command: "echo hello" };
			expect(isHookPrompt(hook)).toBe(false);
		});

		test("narrows type correctly", () => {
			const hook: Hook = { type: "prompt", prompt: "Check if task is done", timeout: 30 };
			if (isHookPrompt(hook)) {
				// TypeScript should know this is HookPrompt
				expect(hook.prompt).toBe("Check if task is done");
				expect(hook.timeout).toBe(30);
			}
		});
	});

	describe("isMatcherEvent", () => {
		test("returns true for PreToolUse", () => {
			expect(isMatcherEvent("PreToolUse")).toBe(true);
		});

		test("returns true for PostToolUse", () => {
			expect(isMatcherEvent("PostToolUse")).toBe(true);
		});

		test("returns true for PermissionRequest", () => {
			expect(isMatcherEvent("PermissionRequest")).toBe(true);
		});

		test("returns true for Notification", () => {
			expect(isMatcherEvent("Notification")).toBe(true);
		});

		test("returns true for SessionStart", () => {
			expect(isMatcherEvent("SessionStart")).toBe(true);
		});

		test("returns true for PreCompact", () => {
			expect(isMatcherEvent("PreCompact")).toBe(true);
		});

		test("returns false for Stop", () => {
			expect(isMatcherEvent("Stop")).toBe(false);
		});

		test("returns false for SubagentStop", () => {
			expect(isMatcherEvent("SubagentStop")).toBe(false);
		});

		test("returns false for UserPromptSubmit", () => {
			expect(isMatcherEvent("UserPromptSubmit")).toBe(false);
		});

		test("returns false for SessionEnd", () => {
			expect(isMatcherEvent("SessionEnd")).toBe(false);
		});

		test("returns false for unknown events", () => {
			expect(isMatcherEvent("Unknown")).toBe(false);
		});
	});

	describe("isPromptHookEvent", () => {
		test("returns true for Stop", () => {
			expect(isPromptHookEvent("Stop")).toBe(true);
		});

		test("returns true for SubagentStop", () => {
			expect(isPromptHookEvent("SubagentStop")).toBe(true);
		});

		test("returns true for UserPromptSubmit", () => {
			expect(isPromptHookEvent("UserPromptSubmit")).toBe(true);
		});

		test("returns true for PreToolUse", () => {
			expect(isPromptHookEvent("PreToolUse")).toBe(true);
		});

		test("returns true for PermissionRequest", () => {
			expect(isPromptHookEvent("PermissionRequest")).toBe(true);
		});

		test("returns false for PostToolUse", () => {
			expect(isPromptHookEvent("PostToolUse")).toBe(false);
		});

		test("returns false for Notification", () => {
			expect(isPromptHookEvent("Notification")).toBe(false);
		});

		test("returns false for SessionStart", () => {
			expect(isPromptHookEvent("SessionStart")).toBe(false);
		});

		test("returns false for SessionEnd", () => {
			expect(isPromptHookEvent("SessionEnd")).toBe(false);
		});

		test("returns false for PreCompact", () => {
			expect(isPromptHookEvent("PreCompact")).toBe(false);
		});

		test("returns false for unknown events", () => {
			expect(isPromptHookEvent("Unknown")).toBe(false);
		});
	});

	describe("isHookEvent", () => {
		test("returns true for all valid events", () => {
			expect(isHookEvent("PreToolUse")).toBe(true);
			expect(isHookEvent("PostToolUse")).toBe(true);
			expect(isHookEvent("PermissionRequest")).toBe(true);
			expect(isHookEvent("UserPromptSubmit")).toBe(true);
			expect(isHookEvent("Stop")).toBe(true);
			expect(isHookEvent("SubagentStop")).toBe(true);
			expect(isHookEvent("Notification")).toBe(true);
			expect(isHookEvent("SessionStart")).toBe(true);
			expect(isHookEvent("SessionEnd")).toBe(true);
			expect(isHookEvent("PreCompact")).toBe(true);
		});

		test("returns false for invalid events", () => {
			expect(isHookEvent("Unknown")).toBe(false);
			expect(isHookEvent("")).toBe(false);
			expect(isHookEvent("pretooluse")).toBe(false); // case-sensitive
		});
	});

	describe("isHookType", () => {
		test("returns true for command", () => {
			expect(isHookType("command")).toBe(true);
		});

		test("returns true for prompt", () => {
			expect(isHookType("prompt")).toBe(true);
		});

		test("returns false for invalid types", () => {
			expect(isHookType("unknown")).toBe(false);
			expect(isHookType("")).toBe(false);
			expect(isHookType("Command")).toBe(false); // case-sensitive
		});
	});
});
