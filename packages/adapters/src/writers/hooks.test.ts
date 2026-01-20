import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { HooksConfig, SyncBundle } from "@omnidev-ai/core";
import { HooksWriter } from "./hooks.js";

describe("HooksWriter", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("hooks-writer-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	function createBundle(hooks?: HooksConfig): SyncBundle {
		const bundle: SyncBundle = {
			capabilities: [],
			skills: [],
			rules: [],
			docs: [],
			commands: [],
			subagents: [],
			instructionsContent: "",
		};
		if (hooks) {
			bundle.hooks = hooks;
		}
		return bundle;
	}

	test("writes hooks to settings.json", async () => {
		const hooks: HooksConfig = {
			PreToolUse: [
				{
					matcher: "Write",
					hooks: [
						{
							type: "command",
							command: "echo pre-write",
						},
					],
				},
			],
		};
		const bundle = createBundle(hooks);

		const result = await HooksWriter.write(bundle, {
			outputPath: ".claude/settings.json",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([".claude/settings.json"]);
		expect(existsSync(`${testDir}/.claude/settings.json`)).toBe(true);

		const content = JSON.parse(readFileSync(`${testDir}/.claude/settings.json`, "utf-8"));
		expect(content.hooks).toBeDefined();
		expect(content.hooks.PreToolUse).toBeDefined();
	});

	test("preserves existing settings", async () => {
		// Create existing settings
		const existingSettings = {
			someOtherSetting: "value",
			anotherSetting: 123,
		};
		require("node:fs").mkdirSync(`${testDir}/.claude`, { recursive: true });
		writeFileSync(`${testDir}/.claude/settings.json`, JSON.stringify(existingSettings, null, 2));

		const hooks: HooksConfig = {
			PostToolUse: [
				{
					matcher: "Read",
					hooks: [{ type: "command", command: "echo post-read" }],
				},
			],
		};
		const bundle = createBundle(hooks);

		await HooksWriter.write(bundle, {
			outputPath: ".claude/settings.json",
			projectRoot: testDir,
		});

		const content = JSON.parse(readFileSync(`${testDir}/.claude/settings.json`, "utf-8"));
		expect(content.someOtherSetting).toBe("value");
		expect(content.anotherSetting).toBe(123);
		expect(content.hooks).toBeDefined();
	});

	test("returns empty array when no hooks", async () => {
		const bundle = createBundle(undefined);

		const result = await HooksWriter.write(bundle, {
			outputPath: ".claude/settings.json",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([]);
	});

	test("creates parent directories", async () => {
		const hooks: HooksConfig = {
			PreToolUse: [
				{
					matcher: "*",
					hooks: [{ type: "command", command: "echo test" }],
				},
			],
		};
		const bundle = createBundle(hooks);

		await HooksWriter.write(bundle, {
			outputPath: ".claude/settings.json",
			projectRoot: testDir,
		});

		expect(existsSync(`${testDir}/.claude/settings.json`)).toBe(true);
	});

	test("has correct id", () => {
		expect(HooksWriter.id).toBe("hooks");
	});
});
