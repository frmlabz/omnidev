import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types";
import { createManagedOutput } from "./managed-outputs";

/**
 * Writer for skills directories.
 *
 * Writes skills from the sync bundle to the specified directory.
 * Each skill gets its own subdirectory with a SKILL.md file.
 *
 * Used by claude-code (.claude/skills/) and potentially other adapters.
 */
export const SkillsWriter: FileWriter = {
	id: "skills",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const skillsDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(skillsDir, { recursive: true });

		const filesWritten: string[] = [];
		const managedOutputs = [];

		for (const skill of bundle.skills) {
			const skillDir = join(skillsDir, skill.name);
			await mkdir(skillDir, { recursive: true });

			const skillPath = join(skillDir, "SKILL.md");
			const content = `---
name: ${skill.name}
description: "${skill.description}"
---

${skill.instructions}`;

			await writeFile(skillPath, content, "utf-8");
			const relativePath = join(ctx.outputPath, skill.name, "SKILL.md");
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
