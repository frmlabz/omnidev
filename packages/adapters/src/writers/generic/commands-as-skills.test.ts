import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { Command, SyncBundle } from "@omnidev-ai/core";
import { CommandsAsSkillsWriter } from "./commands-as-skills";

describe("CommandsAsSkillsWriter", () => {
	const testDir = setupTestDir("commands-as-skills-writer-", { chdir: true });

	function createBundle(commands: Command[]): SyncBundle {
		return {
			capabilities: [],
			skills: [],
			rules: [],
			docs: [],
			commands,
			subagents: [],
			instructionsContent: "",
		};
	}

	test("writes commands as skill files", async () => {
		const command: Command = {
			name: "review-pr",
			description: "Review a pull request",
			prompt: "Review this PR.",
			capabilityId: "review",
		};

		const result = await CommandsAsSkillsWriter.write(createBundle([command]), {
			outputPath: ".codex/skills/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".codex/skills/review-pr/SKILL.md"]);
		expect(existsSync(`${testDir.path}/.codex/skills/review-pr/SKILL.md`)).toBe(true);
	});

	test("escapes quotes in generated skill frontmatter", async () => {
		const description = `Run a "quick audit," then report 'risks'.`;
		const allowedTools = `Bash(git diff:*), Bash(echo "done")`;
		const command: Command = {
			name: "audit",
			description,
			allowedTools,
			prompt: "Audit the change.",
			capabilityId: "review",
		};

		await CommandsAsSkillsWriter.write(createBundle([command]), {
			outputPath: ".codex/skills/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.codex/skills/audit/SKILL.md`, "utf-8");
		expect(content).toContain(`description: ${JSON.stringify(description)}`);
		expect(content).toContain(`allowed_tools: ${JSON.stringify(allowedTools)}`);
		expect(content).not.toContain('description: "Run a "quick audit,"');
	});
});
