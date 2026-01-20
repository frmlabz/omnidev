import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import type { SyncBundle } from "@omnidev-ai/core";
import { InstructionsMdWriter } from "./instructions-md.js";

describe("InstructionsMdWriter", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("instructions-md-writer-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	function createBundle(instructionsContent: string): SyncBundle {
		return {
			capabilities: [],
			skills: [],
			rules: [],
			docs: [],
			commands: [],
			subagents: [],
			instructionsContent,
		};
	}

	test("writes instructions content to output path", async () => {
		const bundle = createBundle("Test instructions content");

		const result = await InstructionsMdWriter.write(bundle, {
			outputPath: "CLAUDE.md",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual(["CLAUDE.md"]);
		expect(existsSync(`${testDir}/CLAUDE.md`)).toBe(true);

		const content = readFileSync(`${testDir}/CLAUDE.md`, "utf-8");
		expect(content).toContain("## OmniDev");
		expect(content).toContain("Test instructions content");
	});

	test("combines OMNI.md with instructions content", async () => {
		writeFileSync(`${testDir}/OMNI.md`, "# Project Instructions\n\nBase content here.");
		const bundle = createBundle("Additional instructions");

		const result = await InstructionsMdWriter.write(bundle, {
			outputPath: "CLAUDE.md",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual(["CLAUDE.md"]);

		const content = readFileSync(`${testDir}/CLAUDE.md`, "utf-8");
		expect(content).toContain("# Project Instructions");
		expect(content).toContain("Base content here.");
		expect(content).toContain("## OmniDev");
		expect(content).toContain("Additional instructions");
	});

	test("creates parent directories for nested output path", async () => {
		const bundle = createBundle("Nested content");

		const result = await InstructionsMdWriter.write(bundle, {
			outputPath: ".opencode/instructions.md",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual([".opencode/instructions.md"]);
		expect(existsSync(`${testDir}/.opencode/instructions.md`)).toBe(true);

		const content = readFileSync(`${testDir}/.opencode/instructions.md`, "utf-8");
		expect(content).toContain("Nested content");
	});

	test("writes to different output paths (AGENTS.md)", async () => {
		const bundle = createBundle("Codex instructions");

		const result = await InstructionsMdWriter.write(bundle, {
			outputPath: "AGENTS.md",
			projectRoot: testDir,
		});

		expect(result.filesWritten).toEqual(["AGENTS.md"]);
		expect(existsSync(`${testDir}/AGENTS.md`)).toBe(true);

		const content = readFileSync(`${testDir}/AGENTS.md`, "utf-8");
		expect(content).toContain("Codex instructions");
	});

	test("has correct id", () => {
		expect(InstructionsMdWriter.id).toBe("instructions-md");
	});
});
