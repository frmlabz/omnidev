import { describe, expect, test } from "bun:test";
import {
	mergeHooksConfigs,
	mergeAndDeduplicateHooks,
	hasAnyHooks,
	countHooks,
	getEventsWithHooks,
} from "./merger.js";
import type { CapabilityHooks, HooksConfig } from "./types.js";
import { createEmptyValidationResult } from "./validation.js";

function createCapabilityHooks(name: string, config: HooksConfig): CapabilityHooks {
	return {
		capabilityName: name,
		capabilityPath: `/path/to/${name}`,
		config,
		validation: createEmptyValidationResult(),
	};
}

describe("hooks merger", () => {
	describe("mergeHooksConfigs", () => {
		test("returns empty config for empty array", () => {
			const result = mergeHooksConfigs([]);
			expect(result).toEqual({});
		});

		test("returns config as-is for single capability", () => {
			const cap = createCapabilityHooks("test-cap", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo test" }] }],
			});
			const result = mergeHooksConfigs([cap]);
			expect(result.PreToolUse).toHaveLength(1);
			expect(result.PreToolUse?.[0]?.matcher).toBe("Bash");
		});

		test("merges hooks from multiple capabilities", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo cap1" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {
				PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "echo cap2" }] }],
			});

			const result = mergeHooksConfigs([cap1, cap2]);
			expect(result.PreToolUse).toHaveLength(2);
			expect(result.PreToolUse?.[0]?.matcher).toBe("Bash");
			expect(result.PreToolUse?.[1]?.matcher).toBe("Edit");
		});

		test("merges hooks from different events", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo pre" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {
				PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo post" }] }],
			});

			const result = mergeHooksConfigs([cap1, cap2]);
			expect(result.PreToolUse).toHaveLength(1);
			expect(result.PostToolUse).toHaveLength(1);
		});

		test("preserves all matchers without deduplication", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo same" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo same" }] }],
			});

			const result = mergeHooksConfigs([cap1, cap2]);
			// Both matchers are kept (no deduplication)
			expect(result.PreToolUse).toHaveLength(2);
		});

		test("omits description from merged config", () => {
			const cap = createCapabilityHooks("cap1", {
				description: "My hooks description",
				PreToolUse: [{ hooks: [{ type: "command", command: "echo test" }] }],
			});

			const result = mergeHooksConfigs([cap]);
			expect(result.description).toBeUndefined();
		});

		test("skips capabilities with empty hooks", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo test" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {});

			const result = mergeHooksConfigs([cap1, cap2]);
			expect(result.PreToolUse).toHaveLength(1);
		});

		test("handles all event types", () => {
			const cap = createCapabilityHooks("cap1", {
				PreToolUse: [{ hooks: [{ type: "command", command: "echo 1" }] }],
				PostToolUse: [{ hooks: [{ type: "command", command: "echo 2" }] }],
				Stop: [{ hooks: [{ type: "prompt", prompt: "check" }] }],
				SessionStart: [{ hooks: [{ type: "command", command: "echo 3" }] }],
			});

			const result = mergeHooksConfigs([cap]);
			expect(result.PreToolUse).toHaveLength(1);
			expect(result.PostToolUse).toHaveLength(1);
			expect(result.Stop).toHaveLength(1);
			expect(result.SessionStart).toHaveLength(1);
		});
	});

	describe("mergeAndDeduplicateHooks", () => {
		test("without deduplication, behaves like mergeHooksConfigs", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo same" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo same" }] }],
			});

			const result = mergeAndDeduplicateHooks([cap1, cap2]);
			expect(result.PreToolUse).toHaveLength(2);
		});

		test("with deduplication, removes duplicate commands", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo same" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo same" }] }],
			});

			const result = mergeAndDeduplicateHooks([cap1, cap2], { deduplicateCommands: true });
			// First matcher kept, second matcher's hook is duplicate so matcher is removed
			expect(result.PreToolUse).toHaveLength(1);
		});

		test("keeps prompt hooks during deduplication", () => {
			const cap1 = createCapabilityHooks("cap1", {
				Stop: [{ hooks: [{ type: "prompt", prompt: "same prompt" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {
				Stop: [{ hooks: [{ type: "prompt", prompt: "same prompt" }] }],
			});

			const result = mergeAndDeduplicateHooks([cap1, cap2], { deduplicateCommands: true });
			// Prompt hooks are not deduplicated
			expect(result.Stop).toHaveLength(2);
		});

		test("keeps different commands during deduplication", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo first" }] }],
			});
			const cap2 = createCapabilityHooks("cap2", {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo second" }] }],
			});

			const result = mergeAndDeduplicateHooks([cap1, cap2], { deduplicateCommands: true });
			expect(result.PreToolUse).toHaveLength(2);
		});

		test("removes empty matchers after deduplication", () => {
			const cap1 = createCapabilityHooks("cap1", {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{ type: "command", command: "echo same" },
							{ type: "command", command: "echo unique1" },
						],
					},
				],
			});
			const cap2 = createCapabilityHooks("cap2", {
				PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "echo same" }] }],
			});

			const result = mergeAndDeduplicateHooks([cap1, cap2], { deduplicateCommands: true });
			// First matcher has both hooks, "echo same" is seen first
			// Second matcher's only hook is duplicate, so matcher is removed
			expect(result.PreToolUse).toHaveLength(1);
			expect(result.PreToolUse?.[0]?.matcher).toBe("Bash");
		});
	});

	describe("hasAnyHooks", () => {
		test("returns false for empty config", () => {
			expect(hasAnyHooks({})).toBe(false);
		});

		test("returns false for config with empty arrays", () => {
			expect(hasAnyHooks({ PreToolUse: [] })).toBe(false);
		});

		test("returns true for config with hooks", () => {
			expect(
				hasAnyHooks({
					PreToolUse: [{ hooks: [{ type: "command", command: "test" }] }],
				}),
			).toBe(true);
		});

		test("returns true for any event with hooks", () => {
			expect(
				hasAnyHooks({
					SessionEnd: [{ hooks: [{ type: "command", command: "test" }] }],
				}),
			).toBe(true);
		});
	});

	describe("countHooks", () => {
		test("returns 0 for empty config", () => {
			expect(countHooks({})).toBe(0);
		});

		test("returns 0 for config with empty arrays", () => {
			expect(countHooks({ PreToolUse: [] })).toBe(0);
		});

		test("counts hooks in single event", () => {
			expect(
				countHooks({
					PreToolUse: [
						{
							hooks: [
								{ type: "command", command: "test1" },
								{ type: "command", command: "test2" },
							],
						},
					],
				}),
			).toBe(2);
		});

		test("counts hooks across multiple events", () => {
			expect(
				countHooks({
					PreToolUse: [{ hooks: [{ type: "command", command: "test1" }] }],
					PostToolUse: [{ hooks: [{ type: "command", command: "test2" }] }],
					Stop: [{ hooks: [{ type: "prompt", prompt: "check" }] }],
				}),
			).toBe(3);
		});

		test("counts hooks in multiple matchers", () => {
			expect(
				countHooks({
					PreToolUse: [
						{ matcher: "Bash", hooks: [{ type: "command", command: "test1" }] },
						{ matcher: "Edit", hooks: [{ type: "command", command: "test2" }] },
					],
				}),
			).toBe(2);
		});
	});

	describe("getEventsWithHooks", () => {
		test("returns empty array for empty config", () => {
			expect(getEventsWithHooks({})).toEqual([]);
		});

		test("returns empty array for config with empty arrays", () => {
			expect(getEventsWithHooks({ PreToolUse: [] })).toEqual([]);
		});

		test("returns events with hooks", () => {
			const events = getEventsWithHooks({
				PreToolUse: [{ hooks: [{ type: "command", command: "test" }] }],
				Stop: [{ hooks: [{ type: "prompt", prompt: "check" }] }],
			});
			expect(events).toContain("PreToolUse");
			expect(events).toContain("Stop");
			expect(events).toHaveLength(2);
		});

		test("excludes events without hooks", () => {
			const events = getEventsWithHooks({
				PreToolUse: [{ hooks: [{ type: "command", command: "test" }] }],
				PostToolUse: [],
			});
			expect(events).toContain("PreToolUse");
			expect(events).not.toContain("PostToolUse");
		});
	});
});
