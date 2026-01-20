import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { OmniConfig, SyncBundle } from "@omnidev-ai/core";
import { syncAdaptersWithWriters, type AdapterWithWriters } from "./sync.js";
import { InstructionsMdWriter } from "./writers/instructions-md.js";
import { SkillsWriter } from "./writers/skills.js";

describe("syncAdaptersWithWriters", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("sync-adapters-test-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	function createBundle(): SyncBundle {
		return {
			capabilities: [],
			skills: [
				{
					name: "test-skill",
					description: "A test skill",
					instructions: "Test instructions",
					capabilityId: "test-cap",
				},
			],
			rules: [],
			docs: [],
			commands: [],
			subagents: [],
			instructionsContent: "Generated instructions content",
		};
	}

	function createContext() {
		return {
			projectRoot: testDir,
			config: {} as OmniConfig,
		};
	}

	test("syncs multiple adapters", async () => {
		const adapters: AdapterWithWriters[] = [
			{
				id: "claude-code",
				displayName: "Claude Code",
				writers: [
					{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
					{ writer: SkillsWriter, outputPath: ".claude/skills/" },
				],
			},
			{
				id: "codex",
				displayName: "Codex",
				writers: [{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" }],
			},
		];

		const result = await syncAdaptersWithWriters(adapters, createBundle(), createContext());

		expect(result.filesWritten).toContain("CLAUDE.md");
		expect(result.filesWritten).toContain("AGENTS.md");
		expect(result.filesWritten).toContain(".claude/skills/test-skill/SKILL.md");
		expect(result.deduplicatedCount).toBe(0);

		expect(existsSync(`${testDir}/CLAUDE.md`)).toBe(true);
		expect(existsSync(`${testDir}/AGENTS.md`)).toBe(true);
		expect(existsSync(`${testDir}/.claude/skills/test-skill/SKILL.md`)).toBe(true);
	});

	test("deduplicates across adapters", async () => {
		// Both adapters want AGENTS.md
		const adapters: AdapterWithWriters[] = [
			{
				id: "codex",
				displayName: "Codex",
				writers: [{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" }],
			},
			{
				id: "opencode",
				displayName: "OpenCode",
				writers: [{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" }], // duplicate
			},
		];

		const result = await syncAdaptersWithWriters(adapters, createBundle(), createContext());

		expect(result.filesWritten).toEqual(["AGENTS.md"]);
		expect(result.deduplicatedCount).toBe(1);

		// File should only be written once
		const content = readFileSync(`${testDir}/AGENTS.md`, "utf-8");
		expect(content).toContain("Generated instructions content");
	});

	test("provides per-adapter breakdown", async () => {
		const adapters: AdapterWithWriters[] = [
			{
				id: "claude-code",
				displayName: "Claude Code",
				writers: [
					{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
					{ writer: SkillsWriter, outputPath: ".claude/skills/" },
				],
			},
			{
				id: "codex",
				displayName: "Codex",
				writers: [{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" }],
			},
		];

		const result = await syncAdaptersWithWriters(adapters, createBundle(), createContext());

		expect(result.perAdapter.get("claude-code")).toContain("CLAUDE.md");
		expect(result.perAdapter.get("codex")).toContain("AGENTS.md");
	});

	test("handles empty adapters list", async () => {
		const result = await syncAdaptersWithWriters([], createBundle(), createContext());

		expect(result.filesWritten).toEqual([]);
		expect(result.deduplicatedCount).toBe(0);
		expect(result.perAdapter.size).toBe(0);
	});

	test("handles adapter with no writers", async () => {
		const adapters: AdapterWithWriters[] = [
			{
				id: "empty-adapter",
				displayName: "Empty",
				writers: [],
			},
		];

		const result = await syncAdaptersWithWriters(adapters, createBundle(), createContext());

		expect(result.filesWritten).toEqual([]);
		expect(result.deduplicatedCount).toBe(0);
	});
});
