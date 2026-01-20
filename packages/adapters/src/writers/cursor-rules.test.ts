import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { Rule, SyncBundle } from "@omnidev-ai/core";
import { CursorRulesWriter } from "./cursor-rules.js";

describe("CursorRulesWriter", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("cursor-rules-writer-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

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
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([".cursor/rules/omnidev-test-rule.mdc"]);
		expect(existsSync(`${testDir}/.cursor/rules/omnidev-test-rule.mdc`)).toBe(true);

		const content = readFileSync(`${testDir}/.cursor/rules/omnidev-test-rule.mdc`, "utf-8");
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
			projectRoot: testDir,
		});

		expect(result.filesWritten).toHaveLength(2);
		expect(result.filesWritten).toContain(".cursor/rules/omnidev-rule-one.mdc");
		expect(result.filesWritten).toContain(".cursor/rules/omnidev-rule-two.mdc");

		expect(existsSync(`${testDir}/.cursor/rules/omnidev-rule-one.mdc`)).toBe(true);
		expect(existsSync(`${testDir}/.cursor/rules/omnidev-rule-two.mdc`)).toBe(true);
	});

	test("returns empty array when no rules", async () => {
		const bundle = createBundle([]);

		const result = await CursorRulesWriter.write(bundle, {
			outputPath: ".cursor/rules/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([]);
	});

	test("has correct id", () => {
		expect(CursorRulesWriter.id).toBe("cursor-rules");
	});
});
