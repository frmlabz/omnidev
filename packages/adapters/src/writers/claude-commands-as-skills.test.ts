import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { Command, SyncBundle } from "@omnidev-ai/core";
import { ClaudeCommandsAsSkillsWriter } from "./claude-commands-as-skills.js";

describe("ClaudeCommandsAsSkillsWriter", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("claude-commands-writer-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

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

	test("has correct id", () => {
		expect(ClaudeCommandsAsSkillsWriter.id).toBe("claude-commands-as-skills");
	});

	test("writes command as skill", async () => {
		const commands: Command[] = [
			{
				name: "review-pr",
				description: "Review a pull request",
				prompt: "Review the PR at $1",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(commands);

		const result = await ClaudeCommandsAsSkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([".claude/skills/review-pr/SKILL.md"]);
		expect(existsSync(`${testDir}/.claude/skills/review-pr/SKILL.md`)).toBe(true);

		const content = readFileSync(`${testDir}/.claude/skills/review-pr/SKILL.md`, "utf-8");
		expect(content).toContain("name: review-pr");
		expect(content).toContain('description: "Review a pull request"');
		expect(content).toContain("Review the PR at $1");
	});

	test("includes allowed_tools when specified", async () => {
		const commands: Command[] = [
			{
				name: "git-status",
				description: "Show git status",
				allowedTools: "Bash(git status:*), Bash(git diff:*)",
				prompt: "Show the current git status.",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(commands);

		await ClaudeCommandsAsSkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.claude/skills/git-status/SKILL.md`, "utf-8");
		expect(content).toContain('allowed_tools: "Bash(git status:*), Bash(git diff:*)"');
	});

	test("writes multiple commands", async () => {
		const commands: Command[] = [
			{
				name: "cmd-one",
				description: "First command",
				prompt: "Prompt one",
				capabilityId: "cap-1",
			},
			{
				name: "cmd-two",
				description: "Second command",
				prompt: "Prompt two",
				capabilityId: "cap-2",
			},
		];
		const bundle = createBundle(commands);

		const result = await ClaudeCommandsAsSkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toHaveLength(2);
		expect(existsSync(`${testDir}/.claude/skills/cmd-one/SKILL.md`)).toBe(true);
		expect(existsSync(`${testDir}/.claude/skills/cmd-two/SKILL.md`)).toBe(true);
	});

	test("returns empty array when no commands", async () => {
		const bundle = createBundle([]);

		const result = await ClaudeCommandsAsSkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([]);
	});

	test("escapes quotes in description", async () => {
		const commands: Command[] = [
			{
				name: "quoted-cmd",
				description: 'Command with "quotes"',
				prompt: "Prompt.",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(commands);

		await ClaudeCommandsAsSkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.claude/skills/quoted-cmd/SKILL.md`, "utf-8");
		expect(content).toContain('description: "Command with \\"quotes\\""');
	});
});
