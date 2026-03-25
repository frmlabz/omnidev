import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "#writers/generic/types";
import { createManagedOutput } from "#writers/generic/managed-outputs";

/**
 * Writer for Cursor commands.
 *
 * Writes commands from the sync bundle to `.cursor/commands/<name>.md`.
 * Each command is a plain Markdown file - Cursor uses the filename as the command name.
 *
 * Cursor commands are invoked with `/command-name` in the chat input.
 * The markdown content describes what the command should do.
 */
export const CursorCommandsWriter: FileWriter = {
	id: "cursor-commands",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const commandsDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(commandsDir, { recursive: true });

		const filesWritten: string[] = [];
		const managedOutputs = [];

		for (const command of bundle.commands) {
			// Cursor commands are plain markdown - the command name is the filename
			// We prepend the description as a heading for context
			const content = `# ${command.name}\n\n${command.description}\n\n${command.prompt}`;

			const commandPath = join(commandsDir, `${command.name}.md`);
			await writeFile(commandPath, content, "utf-8");
			const relativePath = join(ctx.outputPath, `${command.name}.md`);
			filesWritten.push(relativePath);
			managedOutputs.push(createManagedOutput(relativePath, this.id, content));
		}

		return {
			filesWritten,
			managedOutputs,
		};
	},
};
