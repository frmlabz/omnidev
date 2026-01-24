import type {
	ProviderAdapter,
	ProviderContext,
	ProviderInitResult,
	ProviderSyncResult,
	SyncBundle,
} from "@omnidev-ai/core";
import { executeWriters } from "../writers/index.js";
import { ClaudeAgentsWriter } from "../writers/claude-agents.js";
import { ClaudeCommandsAsSkillsWriter } from "../writers/claude-commands-as-skills.js";
import { HooksWriter } from "../writers/hooks.js";
import { InstructionsMdWriter } from "../writers/instructions-md.js";
import { SkillsWriter } from "../writers/skills.js";
import type { AdapterWriterConfig } from "../writers/types.js";

/**
 * Claude Code adapter - writes CLAUDE.md, skills, and hooks.
 */
export const claudeCodeAdapter: ProviderAdapter & { writers: AdapterWriterConfig[] } = {
	id: "claude-code",
	displayName: "Claude Code",

	writers: [
		{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
		{ writer: SkillsWriter, outputPath: ".claude/skills/" },
		{ writer: ClaudeAgentsWriter, outputPath: ".claude/agents/" },
		{ writer: ClaudeCommandsAsSkillsWriter, outputPath: ".claude/skills/" },
		{ writer: HooksWriter, outputPath: ".claude/settings.json" },
	],

	async init(_ctx: ProviderContext): Promise<ProviderInitResult> {
		return {
			filesCreated: [],
			message: "Claude Code adapter initialized",
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
