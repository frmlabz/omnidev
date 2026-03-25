import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { SyncBundle } from "@omnidev-ai/core";
import { executeWriters } from "./executor";
import { InstructionsMdWriter } from "./instructions-md";
import { SkillsWriter } from "./skills";
import type { AdapterWriterConfig, FileWriter } from "./types";

describe("executeWriters", () => {
	const testDir = setupTestDir("executor-test-", { chdir: true });

	function createBundle(): SyncBundle {
		return {
			capabilities: [],
			skills: [
				{
					name: "test-skill",
					description: "Test",
					instructions: "Do test",
					capabilityId: "cap",
				},
			],
			rules: [],
			docs: [],
			commands: [],
			subagents: [],
			instructionsContent: "Test instructions",
		};
	}

	test("executes multiple writers", async () => {
		const bundle = createBundle();
		const writerConfigs: AdapterWriterConfig[] = [
			{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
			{ writer: SkillsWriter, outputPath: ".claude/skills/" },
		];

		const result = await executeWriters(writerConfigs, bundle, testDir.path);

		expect(result.filesWritten).toContain("CLAUDE.md");
		expect(result.filesWritten).toContain(".claude/skills/test-skill/SKILL.md");
		expect(result.deduplicatedCount).toBe(0);
		expect(result.managedOutputs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "CLAUDE.md", writerId: "instructions-md" }),
				expect.objectContaining({
					path: ".claude/skills/test-skill/SKILL.md",
					writerId: "skills",
				}),
			]),
		);

		expect(existsSync(`${testDir.path}/CLAUDE.md`)).toBe(true);
		expect(existsSync(`${testDir.path}/.claude/skills/test-skill/SKILL.md`)).toBe(true);
	});

	test("deduplicates same writer with same path", async () => {
		const bundle = createBundle();
		const writerConfigs: AdapterWriterConfig[] = [
			{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" },
			{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" }, // duplicate
			{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" }, // duplicate
		];

		const result = await executeWriters(writerConfigs, bundle, testDir.path);

		expect(result.filesWritten).toEqual(["AGENTS.md"]);
		expect(result.deduplicatedCount).toBe(2);
		expect(result.managedOutputs).toEqual([
			expect.objectContaining({ path: "AGENTS.md", writerId: "instructions-md" }),
		]);
	});

	test("does not deduplicate same writer with different paths", async () => {
		const bundle = createBundle();
		const writerConfigs: AdapterWriterConfig[] = [
			{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
			{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" },
			{ writer: InstructionsMdWriter, outputPath: ".opencode/instructions.md" },
		];

		const result = await executeWriters(writerConfigs, bundle, testDir.path);

		expect(result.filesWritten).toContain("CLAUDE.md");
		expect(result.filesWritten).toContain("AGENTS.md");
		expect(result.filesWritten).toContain(".opencode/instructions.md");
		expect(result.deduplicatedCount).toBe(0);

		expect(existsSync(`${testDir.path}/CLAUDE.md`)).toBe(true);
		expect(existsSync(`${testDir.path}/AGENTS.md`)).toBe(true);
		expect(existsSync(`${testDir.path}/.opencode/instructions.md`)).toBe(true);
	});

	test("deduplication key is writer.id + outputPath", async () => {
		// Create a custom writer with the same id as InstructionsMdWriter
		const customWriter: FileWriter = {
			id: "instructions-md", // same id
			async write(_bundle, _ctx) {
				// This should NOT be called due to deduplication
				throw new Error("Should not be called");
			},
		};

		const bundle = createBundle();
		const writerConfigs: AdapterWriterConfig[] = [
			{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
			{ writer: customWriter, outputPath: "CLAUDE.md" }, // same id + path = deduped
		];

		const result = await executeWriters(writerConfigs, bundle, testDir.path);

		// The custom writer should be deduped and not throw
		expect(result.filesWritten).toEqual(["CLAUDE.md"]);
		expect(result.deduplicatedCount).toBe(1);
	});

	test("handles empty writer configs", async () => {
		const bundle = createBundle();
		const result = await executeWriters([], bundle, testDir.path);

		expect(result.filesWritten).toEqual([]);
		expect(result.deduplicatedCount).toBe(0);
		expect(result.managedOutputs).toEqual([]);
	});
});
