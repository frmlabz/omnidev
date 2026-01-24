import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle, Command } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types.js";

/**
 * Generate YAML frontmatter for an OpenCode command.
 */
function generateFrontmatter(command: Command): string {
	const lines: string[] = ["---"];

	lines.push(`description: "${command.description.replace(/"/g, '\\"')}"`);

	// Model ID (OpenCode-specific)
	if (command.modelId) {
		lines.push(`model: ${command.modelId}`);
	}

	// Agent to delegate to (OpenCode-specific)
	if (command.agent) {
		lines.push(`agent: ${command.agent}`);
	}

	lines.push("---");

	return lines.join("\n");
}

/**
 * Writer for OpenCode commands.
 *
 * Writes commands from the sync bundle to `.opencode/commands/<name>.md`.
 * Each command gets its own markdown file with OpenCode-specific YAML frontmatter.
 */
export const OpenCodeCommandsWriter: FileWriter = {
	id: "opencode-commands",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const commandsDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(commandsDir, { recursive: true });

		const filesWritten: string[] = [];

		for (const command of bundle.commands) {
			const frontmatter = generateFrontmatter(command);
			const content = `${frontmatter}\n\n${command.prompt}`;

			const commandPath = join(commandsDir, `${command.name}.md`);
			await writeFile(commandPath, content, "utf-8");
			filesWritten.push(join(ctx.outputPath, `${command.name}.md`));
		}

		return {
			filesWritten,
		};
	},
};
