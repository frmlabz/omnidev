import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
	CanonicalProviderId,
	ProviderAdapter,
	ProviderContext,
	ProviderInitResult,
	ProviderSyncResult,
	SyncBundle,
} from "@omnidev-ai/core";
import {
	executeWriters,
	InstructionsMdWriter,
	SkillsWriter,
	type AdapterWriterConfig,
} from "#writers/generic/index";
import { createProviderScopedBundle } from "#provider-bundle";
import { OpenCodeAgentsWriter, OpenCodeCommandsWriter } from "#writers/opencode/index";

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
		const providerId: CanonicalProviderId = "opencode";
		const providerBundle = createProviderScopedBundle(bundle, providerId);
		const result = await executeWriters(this.writers, providerBundle, ctx.projectRoot, providerId);

		return {
			filesWritten: result.filesWritten,
			filesDeleted: [],
			managedOutputs: result.managedOutputs,
		};
	},
};
