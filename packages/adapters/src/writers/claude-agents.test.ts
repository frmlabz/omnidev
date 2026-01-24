import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { Subagent, SyncBundle } from "@omnidev-ai/core";
import { ClaudeAgentsWriter } from "./claude-agents.js";

describe("ClaudeAgentsWriter", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("claude-agents-writer-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

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
		expect(ClaudeAgentsWriter.id).toBe("claude-agents");
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

		const result = await ClaudeAgentsWriter.write(bundle, {
			outputPath: ".claude/agents/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([".claude/agents/code-reviewer.md"]);
		expect(existsSync(`${testDir}/.claude/agents/code-reviewer.md`)).toBe(true);

		const content = readFileSync(`${testDir}/.claude/agents/code-reviewer.md`, "utf-8");
		expect(content).toContain("name: code-reviewer");
		expect(content).toContain('description: "Reviews code for quality"');
		expect(content).toContain("You are a code reviewer.");
	});

	test("writes agent with all fields", async () => {
		const subagents: Subagent[] = [
			{
				name: "full-agent",
				description: "An agent with all fields",
				systemPrompt: "Full system prompt.",
				tools: ["Read", "Glob", "Grep"],
				disallowedTools: ["Bash"],
				model: "sonnet",
				permissionMode: "acceptEdits",
				skills: ["skill-one", "skill-two"],
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		const result = await ClaudeAgentsWriter.write(bundle, {
			outputPath: ".claude/agents/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toHaveLength(1);

		const content = readFileSync(`${testDir}/.claude/agents/full-agent.md`, "utf-8");
		expect(content).toContain("name: full-agent");
		expect(content).toContain("tools: Read, Glob, Grep");
		expect(content).toContain("disallowedTools: Bash");
		expect(content).toContain("model: sonnet");
		expect(content).toContain("permissionMode: acceptEdits");
		expect(content).toContain("skills: skill-one, skill-two");
	});

	test("omits inherit model", async () => {
		const subagents: Subagent[] = [
			{
				name: "inherit-model",
				description: "Agent with inherit model",
				systemPrompt: "Prompt.",
				model: "inherit",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await ClaudeAgentsWriter.write(bundle, {
			outputPath: ".claude/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.claude/agents/inherit-model.md`, "utf-8");
		expect(content).not.toContain("model:");
	});

	test("returns empty array when no subagents", async () => {
		const bundle = createBundle([]);

		const result = await ClaudeAgentsWriter.write(bundle, {
			outputPath: ".claude/agents/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([]);
	});

	test("escapes quotes in description", async () => {
		const subagents: Subagent[] = [
			{
				name: "quoted-agent",
				description: 'Agent with "quotes" in description',
				systemPrompt: "Prompt.",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await ClaudeAgentsWriter.write(bundle, {
			outputPath: ".claude/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.claude/agents/quoted-agent.md`, "utf-8");
		expect(content).toContain('description: "Agent with \\"quotes\\" in description"');
	});
});
