import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
	ProviderAdapter,
	ProviderContext,
	ProviderInitResult,
	ProviderSyncResult,
	SyncBundle,
} from "@omnidev-ai/core";
import { CursorRulesWriter } from "../writers/cursor-rules.js";
import { executeWriters } from "../writers/index.js";
import { InstructionsMdWriter } from "../writers/instructions-md.js";
import { SkillsWriter } from "../writers/skills.js";
import type { AdapterWriterConfig } from "../writers/types.js";

/**
 * Cursor adapter - writes CLAUDE.md, skills, and rules.
 */
export const cursorAdapter: ProviderAdapter & { writers: AdapterWriterConfig[] } = {
	id: "cursor",
	displayName: "Cursor",

	writers: [
		{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
		{ writer: SkillsWriter, outputPath: ".claude/skills/" },
		{ writer: CursorRulesWriter, outputPath: ".cursor/rules/" },
	],

	async init(ctx: ProviderContext): Promise<ProviderInitResult> {
		const rulesDir = join(ctx.projectRoot, ".cursor", "rules");
		mkdirSync(rulesDir, { recursive: true });

		return {
			filesCreated: [".cursor/rules/"],
			message: "Created .cursor/rules/ directory",
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
