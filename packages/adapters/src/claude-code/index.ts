import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	ProviderAdapter,
	ProviderContext,
	ProviderInitResult,
	ProviderSyncResult,
	SyncBundle,
} from "@omnidev-ai/core";

/**
 * Claude Code adapter - writes skills to .claude/skills/ and generates CLAUDE.md from OMNI.md
 */
export const claudeCodeAdapter: ProviderAdapter = {
	id: "claude-code",
	displayName: "Claude Code",

	async init(_ctx: ProviderContext): Promise<ProviderInitResult> {
		// CLAUDE.md is now generated during sync from OMNI.md
		return {
			filesCreated: [],
			message: "Claude Code adapter initialized",
		};
	},

	async sync(bundle: SyncBundle, ctx: ProviderContext): Promise<ProviderSyncResult> {
		const filesWritten: string[] = [];
		const filesDeleted: string[] = [];

		// Generate CLAUDE.md from OMNI.md + .omni/instructions.md
		const claudeMdPath = join(ctx.projectRoot, "CLAUDE.md");
		const claudeMdContent = await generateClaudeMdContent(ctx.projectRoot);
		await writeFile(claudeMdPath, claudeMdContent, "utf-8");
		filesWritten.push("CLAUDE.md");

		const skillsDir = join(ctx.projectRoot, ".claude", "skills");
		mkdirSync(skillsDir, { recursive: true });

		// Write skills to .claude/skills/
		for (const skill of bundle.skills) {
			const skillDir = join(skillsDir, skill.name);
			mkdirSync(skillDir, { recursive: true });

			const skillPath = join(skillDir, "SKILL.md");
			const content = `---
name: ${skill.name}
description: "${skill.description}"
---

${skill.instructions}`;

			await writeFile(skillPath, content, "utf-8");
			filesWritten.push(`.claude/skills/${skill.name}/SKILL.md`);
		}

		return {
			filesWritten,
			filesDeleted,
		};
	},
};

/**
 * Generate CLAUDE.md content from OMNI.md with import directive for instructions
 */
async function generateClaudeMdContent(projectRoot: string): Promise<string> {
	const omniMdPath = join(projectRoot, "OMNI.md");

	let omniMdContent = "";

	if (existsSync(omniMdPath)) {
		omniMdContent = await readFile(omniMdPath, "utf-8");
	}

	// Combine OMNI.md content with @import directive for capability-generated instructions
	let content = omniMdContent;
	content += `\n\n## OmniDev\n\n@import .omni/instructions.md\n`;

	return content;
}
