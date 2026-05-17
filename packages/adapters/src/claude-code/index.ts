import type {
	CanonicalProviderId,
	ProviderContext,
	ProviderInitResult,
	ProviderSyncResult,
	SyncBundle,
} from "@omnidev-ai/core";
import {
	executeWriters,
	HooksWriter,
	InstructionsMdWriter,
	SkillsWriter,
	CommandsAsSkillsWriter,
} from "#writers/generic/index";
import { createProviderScopedBundle } from "#provider-bundle";
import type { WriterBackedProviderAdapter } from "#types";
import { ClaudeAgentsWriter } from "#writers/claude/index";

/**
 * Claude Code adapter - writes CLAUDE.md, skills, and hooks.
 */
export const claudeCodeAdapter: WriterBackedProviderAdapter = {
	id: "claude-code",
	displayName: "Claude Code",
	additionalOutputPaths: [".mcp.json"],

	writers: [
		{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
		{ writer: SkillsWriter, outputPath: ".claude/skills/" },
		{ writer: ClaudeAgentsWriter, outputPath: ".claude/agents/" },
		{ writer: CommandsAsSkillsWriter, outputPath: ".claude/skills/" },
		{ writer: HooksWriter, outputPath: ".claude/settings.json" },
	],

	async init(_ctx: ProviderContext): Promise<ProviderInitResult> {
		return {
			filesCreated: [],
			message: "Claude Code adapter initialized",
		};
	},

	async sync(bundle: SyncBundle, ctx: ProviderContext): Promise<ProviderSyncResult> {
		const providerId: CanonicalProviderId = "claude-code";
		const providerBundle = createProviderScopedBundle(bundle, providerId);
		const result = await executeWriters(this.writers, providerBundle, ctx.projectRoot, providerId);

		return {
			filesWritten: result.filesWritten,
			filesDeleted: [],
			managedOutputs: result.managedOutputs,
		};
	},
};
