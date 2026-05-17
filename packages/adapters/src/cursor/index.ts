import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
	CanonicalProviderId,
	ProviderContext,
	ProviderInitResult,
	ProviderSyncResult,
	SyncBundle,
} from "@omnidev-ai/core";
import { executeWriters, InstructionsMdWriter, SkillsWriter } from "#writers/generic/index";
import {
	CursorAgentsWriter,
	CursorCommandsWriter,
	CursorMcpJsonWriter,
	CursorRulesWriter,
} from "#writers/cursor/index";
import { createProviderScopedBundle } from "#provider-bundle";
import type { WriterBackedProviderAdapter } from "#types";

/**
 * Cursor adapter - writes CLAUDE.md, skills, rules, agents, and commands.
 */
export const cursorAdapter: WriterBackedProviderAdapter = {
	id: "cursor",
	displayName: "Cursor",

	writers: [
		{ writer: InstructionsMdWriter, outputPath: "CLAUDE.md" },
		{ writer: SkillsWriter, outputPath: ".cursor/skills/" },
		{ writer: CursorRulesWriter, outputPath: ".cursor/rules/" },
		{ writer: CursorAgentsWriter, outputPath: ".cursor/agents/" },
		{ writer: CursorCommandsWriter, outputPath: ".cursor/commands/" },
		{ writer: CursorMcpJsonWriter, outputPath: ".cursor/mcp.json" },
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
		const cursorProviderId: CanonicalProviderId = "cursor";
		const instructionsProviderId: CanonicalProviderId = "claude-code";
		const instructionsWriters = this.writers.filter(
			(config) => config.writer.id === "instructions-md",
		);
		const cursorWriters = this.writers.filter((config) => config.writer.id !== "instructions-md");
		const instructionsBundle = createProviderScopedBundle(bundle, instructionsProviderId);
		const cursorBundle = createProviderScopedBundle(bundle, cursorProviderId);

		const instructionsResult = await executeWriters(
			instructionsWriters,
			instructionsBundle,
			ctx.projectRoot,
			instructionsProviderId,
		);
		const cursorResult = await executeWriters(
			cursorWriters,
			cursorBundle,
			ctx.projectRoot,
			cursorProviderId,
		);

		return {
			filesWritten: [
				...new Set([...instructionsResult.filesWritten, ...cursorResult.filesWritten]),
			],
			filesDeleted: [],
			managedOutputs: [...instructionsResult.managedOutputs, ...cursorResult.managedOutputs],
		};
	},
};
