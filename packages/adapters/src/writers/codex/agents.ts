import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CodexSubagentConfig, Subagent, SyncBundle } from "@omnidev-ai/core";
import { stringify } from "smol-toml";
import type { FileWriter, WriterContext, WriterResult } from "#writers/generic/types";
import { createManagedOutput } from "#writers/generic/managed-outputs";

interface CodexAgentFile extends CodexSubagentConfig {
	name: string;
	description: string;
	developer_instructions: string;
	model_reasoning_effort?: CodexSubagentConfig["modelReasoningEffort"];
	sandbox_mode?: CodexSubagentConfig["sandboxMode"];
	nickname_candidates?: CodexSubagentConfig["nicknameCandidates"];
}

function buildCodexAgentFile(agent: Subagent): CodexAgentFile {
	const codex = agent.codex ?? {};

	const file: CodexAgentFile = {
		name: agent.name,
		description: agent.description,
		developer_instructions: agent.systemPrompt,
	};

	if (codex.model) {
		file.model = codex.model;
	}

	if (codex.modelReasoningEffort) {
		file.model_reasoning_effort = codex.modelReasoningEffort;
	}

	if (codex.sandboxMode) {
		file.sandbox_mode = codex.sandboxMode;
	}

	if (codex.nicknameCandidates && codex.nicknameCandidates.length > 0) {
		file.nickname_candidates = codex.nicknameCandidates;
	}

	return file;
}

export const CodexAgentsWriter: FileWriter = {
	id: "codex-agents",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		if (bundle.subagents.length === 0) {
			return { filesWritten: [] };
		}

		const agentsDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(agentsDir, { recursive: true });

		const filesWritten: string[] = [];
		const managedOutputs = [];

		for (const agent of bundle.subagents) {
			const content = stringify(buildCodexAgentFile(agent));
			const relativePath = join(ctx.outputPath, `${agent.name}.toml`);
			const filePath = join(ctx.projectRoot, relativePath);

			await writeFile(filePath, content, "utf-8");
			filesWritten.push(relativePath);
			managedOutputs.push(createManagedOutput(relativePath, this.id, content));
		}

		return {
			filesWritten,
			managedOutputs,
		};
	},
};
