import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Skill } from '../types';

interface SkillFrontmatter {
	name: string;
	description: string;
}

export async function loadSkills(capabilityPath: string, capabilityId: string): Promise<Skill[]> {
	const skillsDir = join(capabilityPath, 'skills');

	if (!existsSync(skillsDir)) {
		return [];
	}

	const skills: Skill[] = [];
	const entries = readdirSync(skillsDir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const skillPath = join(skillsDir, entry.name, 'SKILL.md');
			if (existsSync(skillPath)) {
				const skill = await parseSkillFile(skillPath, capabilityId);
				skills.push(skill);
			}
		}
	}

	return skills;
}

async function parseSkillFile(filePath: string, capabilityId: string): Promise<Skill> {
	const content = await Bun.file(filePath).text();

	// Parse YAML frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

	if (!frontmatterMatch) {
		throw new Error(`Invalid SKILL.md format at ${filePath}: missing YAML frontmatter`);
	}

	const yamlStr = frontmatterMatch[1];
	const instructions = frontmatterMatch[2];

	if (!yamlStr || instructions === undefined) {
		throw new Error(`Invalid SKILL.md format at ${filePath}: missing YAML or markdown content`);
	}

	const frontmatter = parseYamlFrontmatter(yamlStr);

	if (!frontmatter.name || !frontmatter.description) {
		throw new Error(`Invalid SKILL.md at ${filePath}: name and description required`);
	}

	return {
		name: frontmatter.name,
		description: frontmatter.description,
		instructions: instructions.trim(),
		capabilityId,
	};
}

function parseYamlFrontmatter(yaml: string): SkillFrontmatter {
	const result: Record<string, string> = {};

	for (const line of yaml.split('\n')) {
		const match = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
		if (match) {
			const key = match[1];
			const value = match[2];
			if (key && value !== undefined) {
				result[key] = value;
			}
		}
	}

	return result as unknown as SkillFrontmatter;
}
