import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { HooksConfig, SyncBundle } from "@omnidev-ai/core";
import { CodexHooksWriter } from "./hooks";

describe("CodexHooksWriter", () => {
	const testDir = setupTestDir("codex-hooks-writer-", { chdir: true });

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

	test("writes hooks.json with composed hooks", async () => {
		const hooks: HooksConfig = {
			PreToolUse: [
				{
					matcher: "Bash",
					hooks: [{ type: "command", command: "echo codex", timeout: 30 }],
				},
			],
		};

		const result = await CodexHooksWriter.write(createBundle(hooks), {
			outputPath: ".codex/hooks.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".codex/hooks.json"]);
		expect(existsSync(`${testDir.path}/.codex/hooks.json`)).toBe(true);

		const content = JSON.parse(readFileSync(`${testDir.path}/.codex/hooks.json`, "utf-8"));
		expect(content).toEqual({ hooks });
	});

	test("returns empty array when no hooks are present", async () => {
		const result = await CodexHooksWriter.write(createBundle(undefined), {
			outputPath: ".codex/hooks.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
		expect(result.managedOutputs).toBeUndefined();
	});
});
