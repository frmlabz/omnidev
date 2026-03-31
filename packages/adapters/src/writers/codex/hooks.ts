import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "#writers/generic/types";
import { createManagedOutput } from "#writers/generic/managed-outputs";

/**
 * Writer for Codex hooks.json.
 *
 * Writes provider-composed hooks to `.codex/hooks.json`.
 */
export const CodexHooksWriter: FileWriter = {
	id: "codex-hooks",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		if (!bundle.hooks) {
			return { filesWritten: [] };
		}

		const hooksPath = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(dirname(hooksPath), { recursive: true });

		const content = `${JSON.stringify({ hooks: bundle.hooks }, null, 2)}\n`;
		await writeFile(hooksPath, content, "utf-8");

		return {
			filesWritten: [ctx.outputPath],
			managedOutputs: [createManagedOutput(ctx.outputPath, this.id, content)],
		};
	},
};
