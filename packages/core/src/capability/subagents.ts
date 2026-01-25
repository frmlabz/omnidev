import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Subagent, SubagentHooks, SubagentModel, SubagentPermissionMode } from "../types";
import { parseFrontmatterWithMarkdown } from "./yaml-parser";

interface SubagentFrontmatter {
	name?: string;
	description: string;
	tools?: string;
	disallowedTools?: string;
	model?: SubagentModel;
	permissionMode?: SubagentPermissionMode;
	skills?: string;
	hooks?: SubagentHooks;
}

/**
 * Load subagents from a capability directory.
 * Checks multiple directory names: "subagents", "agents", "agent", "subagent"
 * Supports two formats:
 * 1. Subdirectory format: <dir>/<name>/SUBAGENT.md or <dir>/<name>/AGENT.md
 * 2. Flat file format: <dir>/<name>.md (for wrapped capabilities)
 */
export async function loadSubagents(
	capabilityPath: string,
	capabilityId: string,
): Promise<Subagent[]> {
	const subagents: Subagent[] = [];
	const possibleDirNames = ["subagents", "agents", "agent", "subagent"];

	for (const dirName of possibleDirNames) {
		const dir = join(capabilityPath, dirName);

		if (!existsSync(dir)) {
			continue;
		}

		const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		for (const entry of entries) {
			if (entry.isDirectory()) {
				// Subdirectory format: look for SUBAGENT.md or AGENT.md
				let subagentPath = join(dir, entry.name, "SUBAGENT.md");
				if (!existsSync(subagentPath)) {
					subagentPath = join(dir, entry.name, "AGENT.md");
				}
				if (existsSync(subagentPath)) {
					const subagent = await parseSubagentFile(subagentPath, capabilityId);
					subagents.push(subagent);
				}
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				// Flat file format: <dir>/<name>.md (for wrapped capabilities)
				const subagentPath = join(dir, entry.name);
				const subagent = await parseSubagentFile(subagentPath, capabilityId);
				subagents.push(subagent);
			}
		}
	}

	return subagents;
}

async function parseSubagentFile(filePath: string, capabilityId: string): Promise<Subagent> {
	const content = await readFile(filePath, "utf-8");

	const parsed = parseFrontmatterWithMarkdown<SubagentFrontmatter>(content);

	if (!parsed) {
		throw new Error(`Invalid SUBAGENT.md format at ${filePath}: missing YAML frontmatter`);
	}

	const frontmatter = parsed.frontmatter;
	const systemPrompt = parsed.markdown;

	// Infer name from filename if not provided in frontmatter
	const inferredName = basename(filePath, ".md")
		.replace(/^SUBAGENT$/i, "")
		.replace(/^AGENT$/i, "");
	const name = frontmatter.name || inferredName;

	if (!name || !frontmatter.description) {
		throw new Error(`Invalid SUBAGENT.md at ${filePath}: name and description required`);
	}

	const result: Subagent = {
		name,
		description: frontmatter.description,
		systemPrompt: systemPrompt.trim(),
		capabilityId,
	};

	// Add optional fields if present
	if (frontmatter.tools) {
		result.tools = parseCommaSeparatedList(frontmatter.tools);
	}

	if (frontmatter.disallowedTools) {
		result.disallowedTools = parseCommaSeparatedList(frontmatter.disallowedTools);
	}

	if (frontmatter.model) {
		result.model = frontmatter.model;
	}

	if (frontmatter.permissionMode) {
		result.permissionMode = frontmatter.permissionMode;
	}

	if (frontmatter.skills) {
		result.skills = parseCommaSeparatedList(frontmatter.skills);
	}

	if (frontmatter.hooks) {
		result.hooks = frontmatter.hooks;
	}

	return result;
}

function parseCommaSeparatedList(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}
