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
import { OpenCodeAgentsWriter } from "../writers/opencode-agents.js";
import { OpenCodeCommandsWriter } from "../writers/opencode-commands.js";
import { SkillsWriter } from "../writers/skills.js";
import type { AdapterWriterConfig } from "../writers/types.js";

/**
 * OpenCode adapter - generates .opencode/instructions.md and skills from OMNI.md.
 */
export const opencodeAdapter: ProviderAdapter & { writers: AdapterWriterConfig[] } = {
	id: "opencode",
	displayName: "OpenCode",

	writers: [
		{ writer: InstructionsMdWriter, outputPath: "AGENTS.md" },
		{ writer: SkillsWriter, outputPath: ".opencode/skills/" },
		{ writer: OpenCodeAgentsWriter, outputPath: ".opencode/agents/" },
		{ writer: OpenCodeCommandsWriter, outputPath: ".opencode/commands/" },
	],

	async init(ctx: ProviderContext): Promise<ProviderInitResult> {
		const opencodeDir = join(ctx.projectRoot, ".opencode");
		mkdirSync(opencodeDir, { recursive: true });

		return {
			filesCreated: [".opencode/"],
			message: "OpenCode adapter initialized",
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
