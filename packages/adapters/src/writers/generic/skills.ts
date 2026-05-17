import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types";
import { createManagedOutput } from "./managed-outputs";
import { yamlString } from "./yaml-frontmatter";

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
			await rm(skillDir, { recursive: true, force: true });
			if (skill.sourcePath) {
				await cp(skill.sourcePath, skillDir, { recursive: true });
			} else {
				await mkdir(skillDir, { recursive: true });
			}

			const skillPath = join(skillDir, "SKILL.md");
			const content = `---
name: ${skill.name}
description: ${yamlString(skill.description)}
---

${skill.instructions}`;

			await writeFile(skillPath, content, "utf-8");
			const relativePaths = skill.sourcePath ? await listRelativeFiles(skillDir) : ["SKILL.md"];
			for (const relativeFile of relativePaths) {
				filesWritten.push(join(ctx.outputPath, skill.name, relativeFile));
			}

			const relativePath = join(ctx.outputPath, skill.name, "SKILL.md");
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

async function listRelativeFiles(basePath: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(basePath, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = join(basePath, entry.name);
		if (entry.isDirectory()) {
			const nestedFiles = await listRelativeFiles(entryPath);
			for (const nestedFile of nestedFiles) {
				files.push(relative(basePath, join(entryPath, nestedFile)));
			}
			continue;
		}

		if (entry.isFile()) {
			files.push(entry.name);
		}
	}

	return files.sort((a, b) => a.localeCompare(b));
}
