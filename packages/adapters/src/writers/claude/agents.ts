import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle, Subagent } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "#writers/generic/types";
import { createManagedOutput } from "#writers/generic/managed-outputs";

function getClaudeConfig(agent: Subagent) {
	return {
		tools: agent.claude?.tools ?? agent.tools,
		disallowedTools: agent.claude?.disallowedTools ?? agent.disallowedTools,
		model: agent.claude?.model ?? agent.model,
		permissionMode: agent.claude?.permissionMode ?? agent.permissionMode,
		skills: agent.claude?.skills ?? agent.skills,
	};
}

/**
 * Generate YAML frontmatter for a Claude Code agent.
 */
function generateFrontmatter(agent: Subagent): string {
	const claude = getClaudeConfig(agent);
	const lines: string[] = ["---"];

	lines.push(`name: ${agent.name}`);
	lines.push(`description: "${agent.description.replace(/"/g, '\\"')}"`);

	if (claude.tools && claude.tools.length > 0) {
		lines.push(`tools: ${claude.tools.join(", ")}`);
	}

	if (claude.disallowedTools && claude.disallowedTools.length > 0) {
		lines.push(`disallowedTools: ${claude.disallowedTools.join(", ")}`);
	}

	if (claude.model && claude.model !== "inherit") {
		lines.push(`model: ${claude.model}`);
	}

	if (claude.permissionMode && claude.permissionMode !== "default") {
		lines.push(`permissionMode: ${claude.permissionMode}`);
	}

	if (claude.skills && claude.skills.length > 0) {
		lines.push(`skills: ${claude.skills.join(", ")}`);
	}

	lines.push("---");

	return lines.join("\n");
}

/**
 * Writer for Claude Code agents.
 *
 * Writes subagents from the sync bundle to `.claude/agents/<name>.md`.
 * Each agent gets its own markdown file with YAML frontmatter.
 */
export const ClaudeAgentsWriter: FileWriter = {
	id: "claude-agents",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const agentsDir = join(ctx.projectRoot, ctx.outputPath);
		await mkdir(agentsDir, { recursive: true });

		const filesWritten: string[] = [];
		const managedOutputs = [];

		for (const agent of bundle.subagents) {
			const frontmatter = generateFrontmatter(agent);
			const content = `${frontmatter}\n\n${agent.systemPrompt}`;

			const agentPath = join(agentsDir, `${agent.name}.md`);
			await writeFile(agentPath, content, "utf-8");
			const relativePath = join(ctx.outputPath, `${agent.name}.md`);
			filesWritten.push(relativePath);
			managedOutputs.push(createManagedOutput(relativePath, this.id, content));
		}

		return {
			filesWritten,
			managedOutputs,
		};
	},
};
