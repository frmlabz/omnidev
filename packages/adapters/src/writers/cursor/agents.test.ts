import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { Subagent, SyncBundle } from "@omnidev-ai/core";
import { CursorAgentsWriter } from "./agents";

describe("CursorAgentsWriter", () => {
	const testDir = setupTestDir("cursor-agents-writer-", { chdir: true });

	function createBundle(subagents: Subagent[]): SyncBundle {
		return {
			capabilities: [],
			skills: [],
			rules: [],
			docs: [],
			commands: [],
			subagents,
			instructionsContent: "",
		};
	}

	test("has correct id", () => {
		expect(CursorAgentsWriter.id).toBe("cursor-agents");
	});

	test("writes agent to output directory", async () => {
		const subagents: Subagent[] = [
			{
				name: "code-reviewer",
				description: "Reviews code for quality",
				systemPrompt: "You are a code reviewer.",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		const result = await CursorAgentsWriter.write(bundle, {
			outputPath: ".cursor/agents/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".cursor/agents/code-reviewer.md"]);
		expect(existsSync(`${testDir.path}/.cursor/agents/code-reviewer.md`)).toBe(true);

		const content = readFileSync(`${testDir.path}/.cursor/agents/code-reviewer.md`, "utf-8");
		expect(content).toContain("name: code-reviewer");
		expect(content).toContain('description: "Reviews code for quality"');
		expect(content).toContain("model: inherit");
		expect(content).toContain("You are a code reviewer.");
	});

	test("maps haiku model to fast", async () => {
		const subagents: Subagent[] = [
			{
				name: "fast-agent",
				description: "Uses fast model",
				systemPrompt: "Prompt.",
				model: "haiku",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await CursorAgentsWriter.write(bundle, {
			outputPath: ".cursor/agents/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.cursor/agents/fast-agent.md`, "utf-8");
		expect(content).toContain("model: fast");
	});

	test("maps sonnet/opus model to inherit", async () => {
		const subagents: Subagent[] = [
			{
				name: "sonnet-agent",
				description: "Uses sonnet",
				systemPrompt: "Prompt.",
				model: "sonnet",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await CursorAgentsWriter.write(bundle, {
			outputPath: ".cursor/agents/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.cursor/agents/sonnet-agent.md`, "utf-8");
		expect(content).toContain("model: inherit");
	});

	test("maps plan permission mode to readonly", async () => {
		const subagents: Subagent[] = [
			{
				name: "readonly-agent",
				description: "Readonly agent",
				systemPrompt: "Prompt.",
				permissionMode: "plan",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await CursorAgentsWriter.write(bundle, {
			outputPath: ".cursor/agents/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.cursor/agents/readonly-agent.md`, "utf-8");
		expect(content).toContain("readonly: true");
	});

	test("does not include readonly for non-plan permission modes", async () => {
		const subagents: Subagent[] = [
			{
				name: "normal-agent",
				description: "Normal agent",
				systemPrompt: "Prompt.",
				permissionMode: "acceptEdits",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await CursorAgentsWriter.write(bundle, {
			outputPath: ".cursor/agents/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.cursor/agents/normal-agent.md`, "utf-8");
		expect(content).not.toContain("readonly:");
	});

	test("returns empty array when no subagents", async () => {
		const bundle = createBundle([]);

		const result = await CursorAgentsWriter.write(bundle, {
			outputPath: ".cursor/agents/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
	});

	test("escapes quotes in description", async () => {
		const subagents: Subagent[] = [
			{
				name: "quoted-agent",
				description: 'Agent with "quotes"',
				systemPrompt: "Prompt.",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await CursorAgentsWriter.write(bundle, {
			outputPath: ".cursor/agents/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.cursor/agents/quoted-agent.md`, "utf-8");
		expect(content).toContain('description: "Agent with \\"quotes\\""');
	});
});
