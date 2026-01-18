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
 * OpenCode adapter - generates .opencode/instructions.md from OMNI.md
 */
export const opencodeAdapter: ProviderAdapter = {
	id: "opencode",
	displayName: "OpenCode",

	async init(ctx: ProviderContext): Promise<ProviderInitResult> {
		// Create .opencode directory (instructions.md is generated during sync)
		const opencodeDir = join(ctx.projectRoot, ".opencode");
		mkdirSync(opencodeDir, { recursive: true });

		return {
			filesCreated: [".opencode/"],
			message: "OpenCode adapter initialized",
		};
	},

	async sync(_bundle: SyncBundle, ctx: ProviderContext): Promise<ProviderSyncResult> {
		const filesWritten: string[] = [];
		const filesDeleted: string[] = [];

		const opencodeDir = join(ctx.projectRoot, ".opencode");
		mkdirSync(opencodeDir, { recursive: true });

		// Generate .opencode/instructions.md from OMNI.md + .omni/instructions.md
		const instructionsPath = join(opencodeDir, "instructions.md");
		const instructionsContent = await generateOpencodeInstructionsContent(ctx.projectRoot);
		await writeFile(instructionsPath, instructionsContent, "utf-8");
		filesWritten.push(".opencode/instructions.md");

		return {
			filesWritten,
			filesDeleted,
		};
	},
};

/**
 * Generate .opencode/instructions.md content from OMNI.md with import directive
 */
async function generateOpencodeInstructionsContent(projectRoot: string): Promise<string> {
	const omniMdPath = join(projectRoot, "OMNI.md");

	let omniMdContent = "";

	if (existsSync(omniMdPath)) {
		omniMdContent = await readFile(omniMdPath, "utf-8");
	}

	// Combine OMNI.md content with @import directive for capability-generated instructions
	let content = omniMdContent;
	content += `\n\n## OmniDev\n\n@import ../.omni/instructions.md\n`;

	return content;
}
