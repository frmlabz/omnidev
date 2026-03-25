import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Skill } from "../types";
import { loadCapabilityEnvVariables } from "./env";
import { parseFrontmatterWithMarkdown } from "./yaml-parser";

interface SkillFrontmatter {
	name: string;
	description: string;
}

const SKILL_PLACEHOLDER = /\{OMNIDEV_([A-Za-z_][A-Za-z0-9_]*)\}/g;
const SKILL_PLACEHOLDER_DETECTOR = /\{OMNIDEV_([A-Za-z_][A-Za-z0-9_]*)\}/;

function hasSkillPlaceholder(value: string): boolean {
	return SKILL_PLACEHOLDER_DETECTOR.test(value);
}

function resolveSkillPlaceholders(
	content: string,
	variables: Record<string, string>,
	capabilityId: string,
	sourceLabel: string,
): string {
	if (!hasSkillPlaceholder(content)) {
		return content;
	}

	return content.replace(SKILL_PLACEHOLDER, (match, variableName: string) => {
		const resolved = variables[variableName];
		if (resolved === undefined) {
			throw new Error(
				`Missing environment variable "${variableName}" required by capability "${capabilityId}" in ${sourceLabel} (placeholder "${match}")`,
			);
		}
		return resolved;
	});
}

export function parseSkillMarkdown(
	content: string,
	capabilityId: string,
	options?: {
		variables?: Record<string, string>;
		sourceLabel?: string;
	},
): Skill {
	const resolvedContent =
		options?.variables && options.sourceLabel
			? resolveSkillPlaceholders(content, options.variables, capabilityId, options.sourceLabel)
			: content;

	const parsed = parseFrontmatterWithMarkdown<SkillFrontmatter>(resolvedContent);

	if (!parsed) {
		const sourceLabel = options?.sourceLabel ?? "skill content";
		throw new Error(`Invalid SKILL.md format at ${sourceLabel}: missing YAML frontmatter`);
	}

	const frontmatter = parsed.frontmatter;
	const instructions = parsed.markdown;

	if (!frontmatter.name || !frontmatter.description) {
		const sourceLabel = options?.sourceLabel ?? "skill content";
		throw new Error(
			`Invalid SKILL.md at ${sourceLabel}: name and description required in frontmatter`,
		);
	}

	return {
		name: frontmatter.name,
		description: frontmatter.description,
		instructions: instructions.trim(),
		capabilityId,
	};
}

/**
 * Load skills from a capability directory.
 * Checks multiple directory names: "skills", "skill"
 * Skills must be in subdirectory format: <dir>/<name>/SKILL.md
 */
export async function loadSkills(
	capabilityPath: string,
	capabilityId: string,
	variables?: Record<string, string>,
): Promise<Skill[]> {
	const skills: Skill[] = [];
	const possibleDirNames = ["skills", "skill"];
	const resolvedVariables = variables ?? (await loadCapabilityEnvVariables(capabilityPath));

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
					const skill = await parseSkillFile(
						skillPath,
						capabilityId,
						resolvedVariables,
						`skill file ${skillPath}`,
					);
					skills.push(skill);
				}
			}
		}
	}

	return skills;
}

async function parseSkillFile(
	filePath: string,
	capabilityId: string,
	variables: Record<string, string>,
	sourceLabel: string,
): Promise<Skill> {
	const content = await readFile(filePath, "utf-8");

	return parseSkillMarkdown(content, capabilityId, {
		variables,
		sourceLabel,
	});
}
