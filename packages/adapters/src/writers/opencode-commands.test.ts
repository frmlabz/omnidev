import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { Command, SyncBundle } from "@omnidev-ai/core";
import { OpenCodeCommandsWriter } from "./opencode-commands.js";

describe("OpenCodeCommandsWriter", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("opencode-commands-writer-");
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
		expect(OpenCodeCommandsWriter.id).toBe("opencode-commands");
	});

	test("writes command to output directory", async () => {
		const commands: Command[] = [
			{
				name: "review-pr",
				description: "Review a pull request",
				prompt: "Review the PR at $1",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(commands);

		const result = await OpenCodeCommandsWriter.write(bundle, {
			outputPath: ".opencode/commands/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([".opencode/commands/review-pr.md"]);
		expect(existsSync(`${testDir}/.opencode/commands/review-pr.md`)).toBe(true);

		const content = readFileSync(`${testDir}/.opencode/commands/review-pr.md`, "utf-8");
		expect(content).toContain('description: "Review a pull request"');
		expect(content).toContain("Review the PR at $1");
	});

	test("includes modelId when specified", async () => {
		const commands: Command[] = [
			{
				name: "fast-cmd",
				description: "Fast command",
				prompt: "Do something fast.",
				modelId: "anthropic/claude-haiku-3-5",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(commands);

		await OpenCodeCommandsWriter.write(bundle, {
			outputPath: ".opencode/commands/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/commands/fast-cmd.md`, "utf-8");
		expect(content).toContain("model: anthropic/claude-haiku-3-5");
	});

	test("includes agent when specified", async () => {
		const commands: Command[] = [
			{
				name: "delegate-cmd",
				description: "Delegates to agent",
				prompt: "Do the thing.",
				agent: "code-reviewer",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(commands);

		await OpenCodeCommandsWriter.write(bundle, {
			outputPath: ".opencode/commands/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/commands/delegate-cmd.md`, "utf-8");
		expect(content).toContain("agent: code-reviewer");
	});

	test("includes both modelId and agent", async () => {
		const commands: Command[] = [
			{
				name: "full-cmd",
				description: "Full command",
				prompt: "Full prompt.",
				modelId: "anthropic/claude-sonnet-4",
				agent: "my-agent",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(commands);

		await OpenCodeCommandsWriter.write(bundle, {
			outputPath: ".opencode/commands/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/commands/full-cmd.md`, "utf-8");
		expect(content).toContain("model: anthropic/claude-sonnet-4");
		expect(content).toContain("agent: my-agent");
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

		const result = await OpenCodeCommandsWriter.write(bundle, {
			outputPath: ".opencode/commands/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toHaveLength(2);
		expect(existsSync(`${testDir}/.opencode/commands/cmd-one.md`)).toBe(true);
		expect(existsSync(`${testDir}/.opencode/commands/cmd-two.md`)).toBe(true);
	});

	test("returns empty array when no commands", async () => {
		const bundle = createBundle([]);

		const result = await OpenCodeCommandsWriter.write(bundle, {
			outputPath: ".opencode/commands/",
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

		await OpenCodeCommandsWriter.write(bundle, {
			outputPath: ".opencode/commands/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/commands/quoted-cmd.md`, "utf-8");
		expect(content).toContain('description: "Command with \\"quotes\\""');
	});
});
