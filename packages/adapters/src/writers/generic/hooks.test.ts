import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { HooksConfig, SyncBundle } from "@omnidev-ai/core";
import { HooksWriter } from "./hooks";

describe("HooksWriter", () => {
	const testDir = setupTestDir("hooks-writer-", { chdir: true });

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
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".claude/settings.json"]);
		expect(result.managedOutputs).toEqual([
			expect.objectContaining({
				path: ".claude/settings.json",
				writerId: "hooks",
				cleanupStrategy: "remove-json-key",
				jsonKey: "hooks",
			}),
		]);
		expect(existsSync(`${testDir.path}/.claude/settings.json`)).toBe(true);

		const content = JSON.parse(readFileSync(`${testDir.path}/.claude/settings.json`, "utf-8"));
		expect(content.hooks).toBeDefined();
		expect(content.hooks.PreToolUse).toBeDefined();
	});

	test("preserves existing settings", async () => {
		// Create existing settings
		const existingSettings = {
			someOtherSetting: "value",
			anotherSetting: 123,
		};
		require("node:fs").mkdirSync(`${testDir.path}/.claude`, { recursive: true });
		writeFileSync(
			`${testDir.path}/.claude/settings.json`,
			JSON.stringify(existingSettings, null, 2),
		);

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
			projectRoot: testDir.path,
		});

		const content = JSON.parse(readFileSync(`${testDir.path}/.claude/settings.json`, "utf-8"));
		expect(content.someOtherSetting).toBe("value");
		expect(content.anotherSetting).toBe(123);
		expect(content.hooks).toBeDefined();
	});

	test("transforms project-dir placeholders to Claude variables", async () => {
		const hooks: HooksConfig = {
			PostToolUse: [
				{
					matcher: "Write",
					hooks: [
						{
							type: "command",
							command: String.raw`\${OMNIDEV_PROJECT_DIR}/scripts/check.sh`,
						},
					],
				},
			],
		};

		await HooksWriter.write(createBundle(hooks), {
			outputPath: ".claude/settings.json",
			projectRoot: testDir.path,
		});

		const content = JSON.parse(readFileSync(`${testDir.path}/.claude/settings.json`, "utf-8"));
		expect(content.hooks.PostToolUse[0].hooks[0].command).toBe(
			String.raw`\${CLAUDE_PROJECT_DIR}/scripts/check.sh`,
		);
	});

	test("writes Claude-native provider events such as WorktreeRemove", async () => {
		const hooks = {
			WorktreeRemove: [
				{
					hooks: [
						{
							type: "command",
							command: String.raw`\${OMNIDEV_CAPABILITY_ROOT}/hooks/remove.sh`,
						},
					],
				},
			],
		} as HooksConfig;

		await HooksWriter.write(createBundle(hooks), {
			outputPath: ".claude/settings.json",
			projectRoot: testDir.path,
		});

		const content = JSON.parse(readFileSync(`${testDir.path}/.claude/settings.json`, "utf-8"));
		expect(content.hooks.WorktreeRemove[0].hooks[0].command).toBe(
			String.raw`\${CLAUDE_PLUGIN_ROOT}/hooks/remove.sh`,
		);
	});

	test("preserves absolute capability hook commands", async () => {
		const hooks: HooksConfig = {
			SessionStart: [
				{
					hooks: [
						{
							type: "command",
							command: "/tmp/omnidev-cap/hooks/run.sh",
						},
					],
				},
			],
		};

		await HooksWriter.write(createBundle(hooks), {
			outputPath: ".claude/settings.json",
			projectRoot: testDir.path,
		});

		const content = JSON.parse(readFileSync(`${testDir.path}/.claude/settings.json`, "utf-8"));
		expect(content.hooks.SessionStart[0].hooks[0].command).toBe("/tmp/omnidev-cap/hooks/run.sh");
	});

	test("returns empty array when no hooks", async () => {
		const bundle = createBundle(undefined);

		const result = await HooksWriter.write(bundle, {
			outputPath: ".claude/settings.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
		expect(result.managedOutputs).toBeUndefined();
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
			projectRoot: testDir.path,
		});

		expect(existsSync(`${testDir.path}/.claude/settings.json`)).toBe(true);
	});

	test("has correct id", () => {
		expect(HooksWriter.id).toBe("hooks");
	});
});
