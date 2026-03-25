import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle, Subagent, SubagentModel } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "#writers/generic/types";
import { createManagedOutput } from "#writers/generic/managed-outputs";

/**
 * Map OmniDev model names to Cursor model values.
 * Cursor supports: "fast", "inherit", or a specific model ID.
 */
function mapModelToCursor(model: SubagentModel | undefined): string | undefined {
	if (!model || model === "inherit") return "inherit";

	// Map to Cursor model values
	// "fast" uses a faster model for quick operations
	// Specific model IDs can be passed through
	const modelMap: Record<string, string> = {
		haiku: "fast",
		sonnet: "inherit",
		opus: "inherit",
	};

	return modelMap[model] ?? "inherit";
}

/**
 * Generate YAML frontmatter for a Cursor agent.
 */
function generateFrontmatter(agent: Subagent): string {
	const lines: string[] = ["---"];

	lines.push(`name: ${agent.name}`);
	lines.push(`description: "${agent.description.replace(/"/g, '\\"')}"`);

	const model = mapModelToCursor(agent.model);
	if (model) {
		lines.push(`model: ${model}`);
	}

	// Map plan permission mode to readonly
	if (agent.permissionMode === "plan") {
		lines.push("readonly: true");
	}

	// Map background mode from OpenCode-specific field if set
	// Cursor's is_background field
	if ((agent as Subagent & { isBackground?: boolean }).isBackground) {
		lines.push("is_background: true");
	}

	lines.push("---");

	return lines.join("\n");
}

/**
 * Writer for Cursor agents.
 *
 * Writes subagents from the sync bundle to `.cursor/agents/<name>.md`.
 * Each agent gets its own markdown file with Cursor-specific YAML frontmatter.
 *
 * Cursor agent fields:
 * - name: Unique identifier (lowercase, hyphens)
 * - description: When to use this subagent
 * - model: "fast", "inherit", or a specific model ID
 * - readonly: If true, runs with restricted write permissions
 * - is_background: If true, runs in background without waiting
 */
export const CursorAgentsWriter: FileWriter = {
	id: "cursor-agents",

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
