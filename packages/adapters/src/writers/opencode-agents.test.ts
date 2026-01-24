import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { Subagent, SyncBundle } from "@omnidev-ai/core";
import { OpenCodeAgentsWriter } from "./opencode-agents.js";

describe("OpenCodeAgentsWriter", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("opencode-agents-writer-");
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
		expect(OpenCodeAgentsWriter.id).toBe("opencode-agents");
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

		const result = await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([".opencode/agents/code-reviewer.md"]);
		expect(existsSync(`${testDir}/.opencode/agents/code-reviewer.md`)).toBe(true);

		const content = readFileSync(`${testDir}/.opencode/agents/code-reviewer.md`, "utf-8");
		expect(content).toContain('description: "Reviews code for quality"');
		expect(content).toContain("You are a code reviewer.");
	});

	test("maps Claude model to OpenCode model ID", async () => {
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

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/sonnet-agent.md`, "utf-8");
		expect(content).toContain("model: anthropic/claude-sonnet-4");
	});

	test("maps opus model", async () => {
		const subagents: Subagent[] = [
			{
				name: "opus-agent",
				description: "Uses opus",
				systemPrompt: "Prompt.",
				model: "opus",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/opus-agent.md`, "utf-8");
		expect(content).toContain("model: anthropic/claude-opus-4");
	});

	test("maps haiku model", async () => {
		const subagents: Subagent[] = [
			{
				name: "haiku-agent",
				description: "Uses haiku",
				systemPrompt: "Prompt.",
				model: "haiku",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/haiku-agent.md`, "utf-8");
		expect(content).toContain("model: anthropic/claude-haiku-3-5");
	});

	test("uses modelId when provided directly", async () => {
		const subagents: Subagent[] = [
			{
				name: "custom-model",
				description: "Uses custom model",
				systemPrompt: "Prompt.",
				model: "sonnet",
				modelId: "openai/gpt-4o",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/custom-model.md`, "utf-8");
		expect(content).toContain("model: openai/gpt-4o");
		expect(content).not.toContain("anthropic/claude-sonnet-4");
	});

	test("maps tools array to object format", async () => {
		const subagents: Subagent[] = [
			{
				name: "tools-agent",
				description: "Has tools",
				systemPrompt: "Prompt.",
				tools: ["Read", "Glob", "Grep"],
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/tools-agent.md`, "utf-8");
		expect(content).toContain("tools:");
		expect(content).toContain("  read: true");
		expect(content).toContain("  glob: true");
		expect(content).toContain("  grep: true");
	});

	test("uses toolPermissions when provided", async () => {
		const subagents: Subagent[] = [
			{
				name: "custom-tools",
				description: "Has custom tools",
				systemPrompt: "Prompt.",
				tools: ["Read"],
				toolPermissions: { bash: true, write: false },
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/custom-tools.md`, "utf-8");
		expect(content).toContain("  bash: true");
		expect(content).toContain("  write: false");
		expect(content).not.toContain("  read: true"); // toolPermissions takes precedence
	});

	test("maps acceptEdits permission mode", async () => {
		const subagents: Subagent[] = [
			{
				name: "accept-edits",
				description: "Accepts edits",
				systemPrompt: "Prompt.",
				permissionMode: "acceptEdits",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/accept-edits.md`, "utf-8");
		expect(content).toContain("permissions:");
		expect(content).toContain("  edit: allow");
		expect(content).toContain("  bash:");
		expect(content).toContain("    *: ask");
	});

	test("maps dontAsk permission mode", async () => {
		const subagents: Subagent[] = [
			{
				name: "dont-ask",
				description: "Doesnt ask",
				systemPrompt: "Prompt.",
				permissionMode: "dontAsk",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/dont-ask.md`, "utf-8");
		expect(content).toContain("  edit: allow");
		expect(content).toContain("    *: allow");
	});

	test("maps plan permission mode", async () => {
		const subagents: Subagent[] = [
			{
				name: "plan-mode",
				description: "Plan only",
				systemPrompt: "Prompt.",
				permissionMode: "plan",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/plan-mode.md`, "utf-8");
		expect(content).toContain("  edit: deny");
		expect(content).toContain("    *: deny");
	});

	test("includes OpenCode-specific fields", async () => {
		const subagents: Subagent[] = [
			{
				name: "opencode-agent",
				description: "Full OpenCode agent",
				systemPrompt: "Prompt.",
				mode: "primary",
				temperature: 0.7,
				maxSteps: 50,
				hidden: true,
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/opencode-agent.md`, "utf-8");
		expect(content).toContain("mode: primary");
		expect(content).toContain("temperature: 0.7");
		expect(content).toContain("maxSteps: 50");
		expect(content).toContain("hidden: true");
	});

	test("uses custom permissions when provided", async () => {
		const subagents: Subagent[] = [
			{
				name: "custom-perms",
				description: "Custom permissions",
				systemPrompt: "Prompt.",
				permissionMode: "acceptEdits", // Should be overridden
				permissions: {
					edit: "deny",
					bash: { "git *": "allow", "*": "deny" },
					webfetch: "ask",
				},
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(subagents);

		await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		const content = readFileSync(`${testDir}/.opencode/agents/custom-perms.md`, "utf-8");
		expect(content).toContain("  edit: deny");
		expect(content).toContain("  webfetch: ask");
		expect(content).toContain("    git *: allow");
	});

	test("returns empty array when no subagents", async () => {
		const bundle = createBundle([]);

		const result = await OpenCodeAgentsWriter.write(bundle, {
			outputPath: ".opencode/agents/",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([]);
	});
});
