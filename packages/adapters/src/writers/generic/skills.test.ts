import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { Skill, SyncBundle } from "@omnidev-ai/core";
import { SkillsWriter } from "./skills";

describe("SkillsWriter", () => {
	const testDir = setupTestDir("skills-writer-", { chdir: true });

	function createBundle(skills: Skill[]): SyncBundle {
		return {
			capabilities: [],
			skills,
			rules: [],
			docs: [],
			commands: [],
			subagents: [],
			instructionsContent: "",
		};
	}

	test("writes skills to output directory", async () => {
		const skills: Skill[] = [
			{
				name: "test-skill",
				description: "A test skill",
				instructions: "Do the test thing",
				capabilityId: "test-cap",
			},
		];
		const bundle = createBundle(skills);

		const result = await SkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".claude/skills/test-skill/SKILL.md"]);
		expect(result.managedOutputs).toEqual([
			expect.objectContaining({
				path: ".claude/skills/test-skill/SKILL.md",
				writerId: "skills",
				cleanupStrategy: "delete-file-and-prune-empty-parents",
				pruneRoot: ".claude/skills",
			}),
		]);
		expect(existsSync(`${testDir.path}/.claude/skills/test-skill/SKILL.md`)).toBe(true);

		const content = readFileSync(`${testDir.path}/.claude/skills/test-skill/SKILL.md`, "utf-8");
		expect(content).toContain("name: test-skill");
		expect(content).toContain('description: "A test skill"');
		expect(content).toContain("Do the test thing");
	});

	test("writes multiple skills", async () => {
		const skills: Skill[] = [
			{
				name: "skill-one",
				description: "First skill",
				instructions: "Instructions one",
				capabilityId: "cap-1",
			},
			{
				name: "skill-two",
				description: "Second skill",
				instructions: "Instructions two",
				capabilityId: "cap-2",
			},
		];
		const bundle = createBundle(skills);

		const result = await SkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toHaveLength(2);
		expect(result.filesWritten).toContain(".claude/skills/skill-one/SKILL.md");
		expect(result.filesWritten).toContain(".claude/skills/skill-two/SKILL.md");

		expect(existsSync(`${testDir.path}/.claude/skills/skill-one/SKILL.md`)).toBe(true);
		expect(existsSync(`${testDir.path}/.claude/skills/skill-two/SKILL.md`)).toBe(true);
	});

	test("returns empty array when no skills", async () => {
		const bundle = createBundle([]);

		const result = await SkillsWriter.write(bundle, {
			outputPath: ".claude/skills/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
		expect(result.managedOutputs).toEqual([]);
	});

	test("has correct id", () => {
		expect(SkillsWriter.id).toBe("skills");
	});
});
