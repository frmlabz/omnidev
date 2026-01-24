import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle, Command } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types.js";

/**
 * Generate YAML frontmatter for a skill derived from a command.
 */
function generateSkillFrontmatter(command: Command): string {
	const lines: string[] = ["---"];

	lines.push(`name: ${command.name}`);
	lines.push(`description: "${command.description.replace(/"/g, '\\"')}"`);

	if (command.allowedTools) {
		lines.push(`allowed_tools: "${command.allowedTools}"`);
	}

	lines.push("---");

	return lines.join("\n");
}

/**
 * Writer that transforms commands into skills for Claude Code.
 *
 * Since Claude Code doesn't have native command support, commands are
 * materialized as skills in `.claude/skills/<command-name>/SKILL.md`.
 * Users can then invoke `/command-name` using Claude's skill system.
 */
export const ClaudeCommandsAsSkillsWriter: FileWriter = {
	id: "claude-commands-as-skills",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const skillsDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(skillsDir, { recursive: true });

		const filesWritten: string[] = [];

		for (const command of bundle.commands) {
			const commandSkillDir = join(skillsDir, command.name);
			await mkdir(commandSkillDir, { recursive: true });

			const frontmatter = generateSkillFrontmatter(command);
			const content = `${frontmatter}\n\n${command.prompt}`;

			const skillPath = join(commandSkillDir, "SKILL.md");
			await writeFile(skillPath, content, "utf-8");
			filesWritten.push(join(ctx.outputPath, command.name, "SKILL.md"));
		}

		return {
			filesWritten,
		};
	},
};
