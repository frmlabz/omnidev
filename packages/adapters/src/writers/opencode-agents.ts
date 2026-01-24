import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SyncBundle, Subagent, SubagentModel, SubagentPermissionMode } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types.js";

/**
 * Map Claude model names to OpenCode model IDs.
 */
function mapModelToOpenCode(model: SubagentModel | undefined): string | undefined {
	if (!model || model === "inherit") return undefined;

	const modelMap: Record<string, string> = {
		sonnet: "anthropic/claude-sonnet-4",
		opus: "anthropic/claude-opus-4",
		haiku: "anthropic/claude-haiku-3-5",
	};

	return modelMap[model];
}

/**
 * Map Claude permission modes to OpenCode permission structure.
 */
function mapPermissionsToOpenCode(
	permissionMode: SubagentPermissionMode | undefined,
): Record<string, unknown> | undefined {
	if (!permissionMode || permissionMode === "default") return undefined;

	const permissionMap: Record<string, Record<string, unknown>> = {
		acceptEdits: { edit: "allow", bash: { "*": "ask" } },
		dontAsk: { edit: "allow", bash: { "*": "allow" } },
		bypassPermissions: { edit: "allow", bash: { "*": "allow" }, webfetch: "allow" },
		plan: { edit: "deny", bash: { "*": "deny" } },
	};

	return permissionMap[permissionMode];
}

/**
 * Convert tools array to OpenCode tools object format.
 * Claude: ["Read", "Grep", "Glob"]
 * OpenCode: { read: true, grep: true, glob: true }
 */
function mapToolsToOpenCode(tools: string[] | undefined): Record<string, boolean> | undefined {
	if (!tools || tools.length === 0) return undefined;

	const toolsObject: Record<string, boolean> = {};
	for (const tool of tools) {
		toolsObject[tool.toLowerCase()] = true;
	}
	return toolsObject;
}

/**
 * Generate YAML frontmatter for an OpenCode agent.
 */
function generateFrontmatter(agent: Subagent): string {
	const lines: string[] = ["---"];

	lines.push(`description: "${agent.description.replace(/"/g, '\\"')}"`);

	// Use OpenCode-specific modelId if provided, otherwise map from Claude model
	const modelId = agent.modelId ?? mapModelToOpenCode(agent.model);
	if (modelId) {
		lines.push(`model: ${modelId}`);
	}

	// Use OpenCode-specific mode if provided
	if (agent.mode) {
		lines.push(`mode: ${agent.mode}`);
	}

	// Temperature (OpenCode-specific)
	if (agent.temperature !== undefined) {
		lines.push(`temperature: ${agent.temperature}`);
	}

	// Max steps (OpenCode-specific)
	if (agent.maxSteps !== undefined) {
		lines.push(`maxSteps: ${agent.maxSteps}`);
	}

	// Hidden (OpenCode-specific)
	if (agent.hidden !== undefined) {
		lines.push(`hidden: ${agent.hidden}`);
	}

	// Tools - use toolPermissions if provided, otherwise map from tools array
	const toolsObj = agent.toolPermissions ?? mapToolsToOpenCode(agent.tools);
	if (toolsObj) {
		lines.push("tools:");
		for (const [tool, enabled] of Object.entries(toolsObj)) {
			lines.push(`  ${tool}: ${enabled}`);
		}
	}

	// Permissions - use OpenCode-specific permissions if provided, otherwise map from permissionMode
	const permissions = agent.permissions ?? mapPermissionsToOpenCode(agent.permissionMode);
	if (permissions) {
		lines.push("permissions:");
		for (const [key, value] of Object.entries(permissions)) {
			if (typeof value === "object") {
				lines.push(`  ${key}:`);
				for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
					lines.push(`    ${subKey}: ${subValue}`);
				}
			} else {
				lines.push(`  ${key}: ${value}`);
			}
		}
	}

	lines.push("---");

	return lines.join("\n");
}

/**
 * Writer for OpenCode agents.
 *
 * Writes subagents from the sync bundle to `.opencode/agents/<name>.md`.
 * Each agent gets its own markdown file with OpenCode-specific YAML frontmatter.
 */
export const OpenCodeAgentsWriter: FileWriter = {
	id: "opencode-agents",

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
