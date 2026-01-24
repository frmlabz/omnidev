import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle, Subagent } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types.js";

/**
 * Generate YAML frontmatter for a Claude Code agent.
 */
function generateFrontmatter(agent: Subagent): string {
	const lines: string[] = ["---"];

	lines.push(`name: ${agent.name}`);
	lines.push(`description: "${agent.description.replace(/"/g, '\\"')}"`);

	if (agent.tools && agent.tools.length > 0) {
		lines.push(`tools: ${agent.tools.join(", ")}`);
	}

	if (agent.disallowedTools && agent.disallowedTools.length > 0) {
		lines.push(`disallowedTools: ${agent.disallowedTools.join(", ")}`);
	}

	if (agent.model && agent.model !== "inherit") {
		lines.push(`model: ${agent.model}`);
	}

	if (agent.permissionMode && agent.permissionMode !== "default") {
		lines.push(`permissionMode: ${agent.permissionMode}`);
	}

	if (agent.skills && agent.skills.length > 0) {
		lines.push(`skills: ${agent.skills.join(", ")}`);
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

		for (const agent of bundle.subagents) {
			const frontmatter = generateFrontmatter(agent);
			const content = `${frontmatter}\n\n${agent.systemPrompt}`;

			const agentPath = join(agentsDir, `${agent.name}.md`);
			await writeFile(agentPath, content, "utf-8");
			filesWritten.push(join(ctx.outputPath, `${agent.name}.md`));
		}

		return {
			filesWritten,
		};
	},
};
