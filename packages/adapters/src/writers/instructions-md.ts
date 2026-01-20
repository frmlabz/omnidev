import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types.js";

/**
 * Writer for instructions markdown files (CLAUDE.md, AGENTS.md, etc.)
 *
 * Combines OMNI.md content with the generated instructions content from the sync bundle.
 * Used by claude-code (CLAUDE.md), codex (AGENTS.md), and opencode (.opencode/instructions.md).
 */
export const InstructionsMdWriter: FileWriter = {
	id: "instructions-md",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const outputFullPath = join(ctx.projectRoot, ctx.outputPath);

		// Ensure parent directory exists
		const parentDir = dirname(outputFullPath);
		if (parentDir !== ctx.projectRoot) {
			await mkdir(parentDir, { recursive: true });
		}

		// Read OMNI.md if it exists
		const omniMdPath = join(ctx.projectRoot, "OMNI.md");
		let omniMdContent = "";

		if (existsSync(omniMdPath)) {
			omniMdContent = await readFile(omniMdPath, "utf-8");
		}

		// Combine OMNI.md content with instructions
		let content = omniMdContent;
		if (bundle.instructionsContent) {
			content += `\n\n${bundle.instructionsContent}\n`;
		}

		await writeFile(outputFullPath, content, "utf-8");

		return {
			filesWritten: [ctx.outputPath],
		};
	},
};
