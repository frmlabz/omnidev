import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
	ProviderAdapter,
	ProviderContext,
	ProviderInitResult,
	ProviderSyncResult,
	SyncBundle,
} from "@omnidev-ai/core";
import { executeWriters } from "../writers/index.js";
import { InstructionsMdWriter } from "../writers/instructions-md.js";
import { SkillsWriter } from "../writers/skills.js";
import type { AdapterWriterConfig } from "../writers/types.js";

/**
 * Codex adapter - generates AGENTS.md and skills.
 */
export const codexAdapter: ProviderAdapter & { writers: AdapterWriterConfig[] } = {
	id: "codex",
	displayName: "Codex",

	writers: [
		{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" },
		{ writer: SkillsWriter, outputPath: ".codex/skills/" },
	],

	async init(ctx: ProviderContext): Promise<ProviderInitResult> {
		const codexDir = join(ctx.projectRoot, ".codex");
		mkdirSync(codexDir, { recursive: true });

		return {
			filesCreated: [".codex/"],
			message: "Codex adapter initialized",
		};
	},

	async sync(bundle: SyncBundle, ctx: ProviderContext): Promise<ProviderSyncResult> {
		const result = await executeWriters(this.writers, bundle, ctx.projectRoot);

		return {
			filesWritten: result.filesWritten,
			filesDeleted: [],
		};
	},
};
