import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types.js";

/**
 * Writer for Cursor rules files.
 *
 * Writes rules from the sync bundle to .mdc files in the specified directory.
 * Each rule gets its own file prefixed with "omnidev-".
 *
 * Used by cursor (.cursor/rules/).
 */
export const CursorRulesWriter: FileWriter = {
	id: "cursor-rules",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const rulesDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(rulesDir, { recursive: true });

		const filesWritten: string[] = [];

		for (const rule of bundle.rules) {
			const rulePath = join(rulesDir, `omnidev-${rule.name}.mdc`);
			await writeFile(rulePath, rule.content, "utf-8");
			filesWritten.push(join(ctx.outputPath, `omnidev-${rule.name}.mdc`));
		}

		return {
			filesWritten,
		};
	},
};
