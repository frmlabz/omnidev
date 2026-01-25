import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Skill } from "../types";
import { parseFrontmatterWithMarkdown } from "./yaml-parser";

interface SkillFrontmatter {
	name: string;
	description: string;
}

/**
 * Load skills from a capability directory.
 * Checks multiple directory names: "skills", "skill"
 * Skills must be in subdirectory format: <dir>/<name>/SKILL.md
 */
export async function loadSkills(capabilityPath: string, capabilityId: string): Promise<Skill[]> {
	const skills: Skill[] = [];
	const possibleDirNames = ["skills", "skill"];

	for (const dirName of possibleDirNames) {
		const dir = join(capabilityPath, dirName);

		if (!existsSync(dir)) {
			continue;
		}

		const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		for (const entry of entries) {
			if (entry.isDirectory()) {
				// Subdirectory format: <dir>/<name>/SKILL.md
				const skillPath = join(dir, entry.name, "SKILL.md");
				if (existsSync(skillPath)) {
					const skill = await parseSkillFile(skillPath, capabilityId);
					skills.push(skill);
				}
			}
		}
	}

	return skills;
}

async function parseSkillFile(filePath: string, capabilityId: string): Promise<Skill> {
	const content = await readFile(filePath, "utf-8");

	const parsed = parseFrontmatterWithMarkdown<SkillFrontmatter>(content);

	if (!parsed) {
		throw new Error(`Invalid SKILL.md format at ${filePath}: missing YAML frontmatter`);
	}

	const frontmatter = parsed.frontmatter;
	const instructions = parsed.markdown;

	if (!frontmatter.name || !frontmatter.description) {
		throw new Error(
			`Invalid SKILL.md at ${filePath}: name and description required in frontmatter`,
		);
	}

	return {
		name: frontmatter.name,
		description: frontmatter.description,
		instructions: instructions.trim(),
		capabilityId,
	};
}
