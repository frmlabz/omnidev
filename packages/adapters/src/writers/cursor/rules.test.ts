import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { Rule, SyncBundle } from "@omnidev-ai/core";
import { CursorRulesWriter } from "./rules";

describe("CursorRulesWriter", () => {
	const testDir = setupTestDir("cursor-rules-writer-", { chdir: true });

	function createBundle(rules: Rule[]): SyncBundle {
		return {
			capabilities: [],
			skills: [],
			rules,
			docs: [],
			commands: [],
			subagents: [],
			instructionsContent: "",
		};
	}

	test("writes rules to output directory", async () => {
		const rules: Rule[] = [
			{
				name: "test-rule",
				content: "Rule content here",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(rules);

		const result = await CursorRulesWriter.write(bundle, {
			outputPath: ".cursor/rules/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".cursor/rules/omnidev-test-rule.mdc"]);
		expect(result.managedOutputs).toEqual([
			expect.objectContaining({
				path: ".cursor/rules/omnidev-test-rule.mdc",
				writerId: "cursor-rules",
				cleanupStrategy: "delete-file",
			}),
		]);
		expect(existsSync(`${testDir.path}/.cursor/rules/omnidev-test-rule.mdc`)).toBe(true);

		const content = readFileSync(`${testDir.path}/.cursor/rules/omnidev-test-rule.mdc`, "utf-8");
		expect(content).toBe("Rule content here");
	});

	test("writes multiple rules", async () => {
		const rules: Rule[] = [
			{
				name: "rule-one",
				content: "Content one",
				capabilityId: "cap-1",
			},
			{
				name: "rule-two",
				content: "Content two",
				capabilityId: "cap-2",
			},
		];
		const bundle = createBundle(rules);

		const result = await CursorRulesWriter.write(bundle, {
			outputPath: ".cursor/rules/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toHaveLength(2);
		expect(result.filesWritten).toContain(".cursor/rules/omnidev-rule-one.mdc");
		expect(result.filesWritten).toContain(".cursor/rules/omnidev-rule-two.mdc");

		expect(existsSync(`${testDir.path}/.cursor/rules/omnidev-rule-one.mdc`)).toBe(true);
		expect(existsSync(`${testDir.path}/.cursor/rules/omnidev-rule-two.mdc`)).toBe(true);
	});

	test("returns empty array when no rules", async () => {
		const bundle = createBundle([]);

		const result = await CursorRulesWriter.write(bundle, {
			outputPath: ".cursor/rules/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
		expect(result.managedOutputs).toEqual([]);
	});

	test("has correct id", () => {
		expect(CursorRulesWriter.id).toBe("cursor-rules");
	});
});
