import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle, Command } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "#writers/generic/types";
import { createManagedOutput } from "#writers/generic/managed-outputs";
import { yamlString } from "#writers/generic/yaml-frontmatter";

/**
 * Generate YAML frontmatter for a skill derived from a command.
 */
function generateSkillFrontmatter(command: Command): string {
	const lines: string[] = ["---"];

	lines.push(`name: ${command.name}`);
	lines.push(`description: ${yamlString(command.description)}`);

	if (command.allowedTools) {
		lines.push(`allowed_tools: ${yamlString(command.allowedTools)}`);
	}

	lines.push("---");

	return lines.join("\n");
}

/**
 * Writer that transforms commands into skills.
 *
 * For providers that don't have native command support (like Claude Code and Codex),
 * commands are materialized as skills in `<provider>/skills/<command-name>/SKILL.md`.
 * Users can then invoke `/command-name` using the provider's skill system.
 */
export const CommandsAsSkillsWriter: FileWriter = {
	id: "commands-as-skills",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const skillsDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(skillsDir, { recursive: true });

		const filesWritten: string[] = [];
		const managedOutputs = [];

		for (const command of bundle.commands) {
			const commandSkillDir = join(skillsDir, command.name);
			await mkdir(commandSkillDir, { recursive: true });

			const frontmatter = generateSkillFrontmatter(command);
			const content = `${frontmatter}\n\n${command.prompt}`;

			const skillPath = join(commandSkillDir, "SKILL.md");
			await writeFile(skillPath, content, "utf-8");
			const relativePath = join(ctx.outputPath, command.name, "SKILL.md");
			filesWritten.push(relativePath);
			managedOutputs.push(
				createManagedOutput(relativePath, this.id, content, {
					cleanupStrategy: "delete-file-and-prune-empty-parents",
					pruneRoot: ctx.outputPath,
				}),
			);
		}

		return {
			filesWritten,
			managedOutputs,
		};
	},
};
