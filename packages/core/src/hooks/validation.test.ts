// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Testing variable patterns requires ${} syntax in strings
import { describe, expect, test } from "bun:test";
import {
	validateHooksConfig,
	validateHook,
	isValidMatcherPattern,
	findDuplicateCommands,
	createEmptyHooksConfig,
	createEmptyValidationResult,
} from "./validation.js";
import type { HooksConfig } from "./types.js";

describe("hooks validation", () => {
	describe("validateHooksConfig", () => {
		test("validates valid minimal config", () => {
			const config = {};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.warnings).toHaveLength(0);
		});

		test("validates config with description", () => {
			const config = { description: "My hooks" };
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("validates valid config with PreToolUse", () => {
			const config = {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "echo hello" }],
					},
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		test("validates valid config with multiple events", () => {
			const config = {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo pre" }] }],
				PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo post" }] }],
				Stop: [{ hooks: [{ type: "prompt", prompt: "Check if done" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("rejects non-object config", () => {
			const result = validateHooksConfig(null);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TOML");
		});

		test("rejects array config", () => {
			const result = validateHooksConfig([]);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TOML");
		});

		test("rejects unknown event names", () => {
			const config = { UnknownEvent: [] };
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_UNKNOWN_EVENT");
			expect(result.errors[0]?.message).toContain("UnknownEvent");
		});

		test("rejects invalid event value (not array)", () => {
			const config = { PreToolUse: "not an array" };
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TOML");
		});

		test("accepts matcher on PreToolUse", () => {
			const config = {
				PreToolUse: [{ matcher: "Bash|Edit", hooks: [{ type: "command", command: "echo test" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("accepts matcher on PostToolUse", () => {
			const config = {
				PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo test" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("accepts matcher on Notification", () => {
			const config = {
				Notification: [
					{ matcher: "permission_prompt", hooks: [{ type: "command", command: "notify-send" }] },
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("warns about matcher on Stop (ignored)", () => {
			const config = {
				Stop: [{ matcher: "SomePattern", hooks: [{ type: "command", command: "echo test" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.code === "HOOKS_INVALID_MATCHER")).toBe(true);
		});

		test("warns about matcher on UserPromptSubmit (ignored)", () => {
			const config = {
				UserPromptSubmit: [
					{ matcher: "SomePattern", hooks: [{ type: "command", command: "echo test" }] },
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.code === "HOOKS_INVALID_MATCHER")).toBe(true);
		});

		test("accepts command type on all events", () => {
			const events = [
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

			for (const event of events) {
				const config = {
					[event]: [{ hooks: [{ type: "command", command: "echo test" }] }],
				};
				const result = validateHooksConfig(config);
				expect(result.valid).toBe(true);
			}
		});

		test("accepts prompt type on Stop", () => {
			const config = {
				Stop: [{ hooks: [{ type: "prompt", prompt: "Check completion" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("accepts prompt type on SubagentStop", () => {
			const config = {
				SubagentStop: [{ hooks: [{ type: "prompt", prompt: "Check subagent" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("accepts prompt type on PreToolUse", () => {
			const config = {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "prompt", prompt: "Validate command" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("rejects prompt type on PostToolUse", () => {
			const config = {
				PostToolUse: [{ matcher: "Write", hooks: [{ type: "prompt", prompt: "Check result" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_PROMPT_NOT_ALLOWED");
		});

		test("rejects prompt type on SessionStart", () => {
			const config = {
				SessionStart: [{ hooks: [{ type: "prompt", prompt: "Check start" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_PROMPT_NOT_ALLOWED");
		});

		test("rejects unknown hook type", () => {
			const config = {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "unknown", command: "test" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TYPE");
		});

		test("rejects command hook without command field", () => {
			const config = {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_MISSING_COMMAND");
		});

		test("rejects prompt hook without prompt field", () => {
			const config = {
				Stop: [{ hooks: [{ type: "prompt" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_MISSING_PROMPT");
		});

		test("rejects hook without type field", () => {
			const config = {
				PreToolUse: [{ matcher: "Bash", hooks: [{ command: "echo test" }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TYPE");
		});

		test("accepts timeout on command hook", () => {
			const config = {
				PreToolUse: [
					{ matcher: "Bash", hooks: [{ type: "command", command: "echo test", timeout: 30 }] },
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("accepts timeout on prompt hook", () => {
			const config = {
				Stop: [{ hooks: [{ type: "prompt", prompt: "Check", timeout: 60 }] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
		});

		test("rejects negative timeout", () => {
			const config = {
				PreToolUse: [
					{ matcher: "Bash", hooks: [{ type: "command", command: "test", timeout: -1 }] },
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TIMEOUT");
		});

		test("rejects non-number timeout", () => {
			const config = {
				PreToolUse: [
					{ matcher: "Bash", hooks: [{ type: "command", command: "test", timeout: "30" }] },
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TIMEOUT");
		});

		test("rejects zero timeout", () => {
			const config = {
				PreToolUse: [
					{ matcher: "Bash", hooks: [{ type: "command", command: "test", timeout: 0 }] },
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("HOOKS_INVALID_TIMEOUT");
		});

		test("warns about empty hooks array", () => {
			const config = {
				PreToolUse: [{ matcher: "Bash", hooks: [] }],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.code === "HOOKS_EMPTY_ARRAY")).toBe(true);
		});

		test("warns about CLAUDE_ variables", () => {
			const config = {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: '"${CLAUDE_PLUGIN_ROOT}/script.sh"' }],
					},
				],
			};
			const result = validateHooksConfig(config);
			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.code === "HOOKS_CLAUDE_VARIABLE")).toBe(true);
		});
	});

	describe("validateMatcherPattern", () => {
		test("accepts simple string: Bash", () => {
			expect(isValidMatcherPattern("Bash")).toBe(true);
		});

		test("accepts regex alternation: Edit|Write", () => {
			expect(isValidMatcherPattern("Edit|Write")).toBe(true);
		});

		test("accepts wildcard: *", () => {
			expect(isValidMatcherPattern("*")).toBe(true);
		});

		test("accepts empty string", () => {
			expect(isValidMatcherPattern("")).toBe(true);
		});

		test("accepts complex regex: mcp__.*__write.*", () => {
			expect(isValidMatcherPattern("mcp__.*__write.*")).toBe(true);
		});

		test("rejects invalid regex: [unclosed", () => {
			expect(isValidMatcherPattern("[unclosed")).toBe(false);
		});

		test("rejects invalid regex: (unclosed", () => {
			expect(isValidMatcherPattern("(unclosed")).toBe(false);
		});
	});

	describe("validateHook", () => {
		test("validates command hook with all fields", () => {
			const hook = { type: "command", command: "echo test", timeout: 30 };
			const issues = validateHook(hook, "PreToolUse", { matcherIndex: 0, hookIndex: 0 });
			expect(issues).toHaveLength(0);
		});

		test("validates prompt hook with all fields", () => {
			const hook = { type: "prompt", prompt: "Check completion", timeout: 60 };
			const issues = validateHook(hook, "Stop", { matcherIndex: 0, hookIndex: 0 });
			expect(issues).toHaveLength(0);
		});

		test("returns error for non-object hook", () => {
			const issues = validateHook("not an object", "PreToolUse", { matcherIndex: 0, hookIndex: 0 });
			expect(issues.some((i) => i.code === "HOOKS_INVALID_TOML")).toBe(true);
		});
	});

	describe("findDuplicateCommands", () => {
		test("finds no duplicates in empty config", () => {
			const config: HooksConfig = {};
			const issues = findDuplicateCommands(config);
			expect(issues).toHaveLength(0);
		});

		test("finds no duplicates when commands are unique", () => {
			const config: HooksConfig = {
				PreToolUse: [{ hooks: [{ type: "command", command: "echo pre" }] }],
				PostToolUse: [{ hooks: [{ type: "command", command: "echo post" }] }],
			};
			const issues = findDuplicateCommands(config);
			expect(issues).toHaveLength(0);
		});

		test("finds duplicates across events", () => {
			const config: HooksConfig = {
				PreToolUse: [{ hooks: [{ type: "command", command: "echo same" }] }],
				PostToolUse: [{ hooks: [{ type: "command", command: "echo same" }] }],
			};
			const issues = findDuplicateCommands(config);
			expect(issues).toHaveLength(1);
			expect(issues[0]?.code).toBe("HOOKS_DUPLICATE_COMMAND");
		});

		test("finds duplicates within same event", () => {
			const config: HooksConfig = {
				PreToolUse: [
					{ hooks: [{ type: "command", command: "echo same" }] },
					{ hooks: [{ type: "command", command: "echo same" }] },
				],
			};
			const issues = findDuplicateCommands(config);
			expect(issues).toHaveLength(1);
		});
	});

	describe("createEmptyHooksConfig", () => {
		test("returns empty object", () => {
			const config = createEmptyHooksConfig();
			expect(config).toEqual({});
		});
	});

	describe("createEmptyValidationResult", () => {
		test("returns valid result with no issues", () => {
			const result = createEmptyValidationResult();
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.warnings).toHaveLength(0);
		});
	});
});
