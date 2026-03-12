import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { SyncBundle } from "@omnidev-ai/core";
import { InstructionsMdWriter } from "./instructions-md";

describe("InstructionsMdWriter", () => {
	const testDir = setupTestDir("instructions-md-writer-", { chdir: true });

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
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual(["CLAUDE.md"]);
		expect(existsSync(`${testDir.path}/CLAUDE.md`)).toBe(true);

		const content = readFileSync(`${testDir.path}/CLAUDE.md`, "utf-8");
		expect(content).toContain("Test instructions content");
	});

	test("combines OMNI.md with instructions content", async () => {
		writeFileSync(`${testDir.path}/OMNI.md`, "# Project Instructions\n\nBase content here.");
		const bundle = createBundle("Additional instructions");

		const result = await InstructionsMdWriter.write(bundle, {
			outputPath: "CLAUDE.md",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual(["CLAUDE.md"]);

		const content = readFileSync(`${testDir.path}/CLAUDE.md`, "utf-8");
		expect(content).toContain("# Project Instructions");
		expect(content).toContain("Base content here.");
		expect(content).toContain("Additional instructions");
	});

	test("does not append anything when instructionsContent is empty", async () => {
		writeFileSync(`${testDir.path}/OMNI.md`, "# Project Instructions\n\nBase content here.");
		const bundle = createBundle("");

		await InstructionsMdWriter.write(bundle, {
			outputPath: "CLAUDE.md",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/CLAUDE.md`, "utf-8");
		expect(content).toBe("# Project Instructions\n\nBase content here.");
	});

	test("creates parent directories for nested output path", async () => {
		const bundle = createBundle("Nested content");

		const result = await InstructionsMdWriter.write(bundle, {
			outputPath: ".opencode/instructions.md",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".opencode/instructions.md"]);
		expect(existsSync(`${testDir.path}/.opencode/instructions.md`)).toBe(true);

		const content = readFileSync(`${testDir.path}/.opencode/instructions.md`, "utf-8");
		expect(content).toContain("Nested content");
	});

	test("writes to different output paths (AGENTS.md)", async () => {
		const bundle = createBundle("Codex instructions");

		const result = await InstructionsMdWriter.write(bundle, {
			outputPath: "AGENTS.md",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual(["AGENTS.md"]);
		expect(existsSync(`${testDir.path}/AGENTS.md`)).toBe(true);

		const content = readFileSync(`${testDir.path}/AGENTS.md`, "utf-8");
		expect(content).toContain("Codex instructions");
	});

	test("renders provider-scoped OMNI.md blocks for provider aliases", async () => {
		writeFileSync(
			`${testDir.path}/OMNI.md`,
			`# Project Instructions

Shared content.

<provider.claude>
Claude only content.
</provider.claude>

<provider.codex>
Codex only content.
</provider.codex>`,
		);
		const bundle = createBundle("Additional instructions");

		await InstructionsMdWriter.write(bundle, {
			outputPath: "CLAUDE.md",
			projectRoot: testDir.path,
			providerId: "claude-code",
		});

		const content = readFileSync(`${testDir.path}/CLAUDE.md`, "utf-8");
		expect(content).toContain("Shared content.");
		expect(content).toContain("Claude only content.");
		expect(content).not.toContain("Codex only content.");
	});

	test("throws on unknown provider tags in OMNI.md", async () => {
		writeFileSync(
			`${testDir.path}/OMNI.md`,
			`# Project Instructions

<provider.windsurf>
Unknown provider content.
</provider.windsurf>`,
		);

		await expect(
			InstructionsMdWriter.write(createBundle(""), {
				outputPath: "CLAUDE.md",
				projectRoot: testDir.path,
				providerId: "claude-code",
			}),
		).rejects.toThrow(/Unknown provider: windsurf/);
	});

	test("has correct id", () => {
		expect(InstructionsMdWriter.id).toBe("instructions-md");
	});
});
