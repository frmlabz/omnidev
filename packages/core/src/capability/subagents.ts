import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse as parseToml } from "smol-toml";
import type {
	CodexModelReasoningEffort,
	CodexSandboxMode,
	ClaudeSubagentConfig,
	CodexSubagentConfig,
	Subagent,
	SubagentHooks,
	SubagentModel,
	SubagentPermissionMode,
} from "../types";
import { parseFrontmatterWithMarkdown } from "./yaml-parser";

interface LegacySubagentFrontmatter {
	name?: string;
	description: string;
	tools?: string;
	disallowedTools?: string;
	model?: SubagentModel;
	permissionMode?: SubagentPermissionMode;
	skills?: string;
	hooks?: SubagentHooks;
}

interface SubagentManifest {
	name?: unknown;
	description?: unknown;
	claude?: {
		tools?: unknown;
		disallowed_tools?: unknown;
		model?: unknown;
		permission_mode?: unknown;
		skills?: unknown;
		hooks?: unknown;
	};
	codex?: {
		model?: unknown;
		model_reasoning_effort?: unknown;
		sandbox_mode?: unknown;
		nickname_candidates?: unknown;
	};
}

const POSSIBLE_DIR_NAMES = ["subagents", "agents", "agent", "subagent"];
const LEGACY_AGENT_FILES = ["SUBAGENT.md", "subagent.md", "AGENT.md", "agent.md", "Agent.md"];
const MANIFEST_FILE_NAMES = ["agent.toml", "AGENT.toml"];
const PROMPT_FILE_NAMES = ["prompt.md", "PROMPT.md"];

/**
 * Load subagents from a capability directory.
 * Checks multiple directory names: "subagents", "agents", "agent", "subagent"
 * Supports:
 * 1. Neutral manifest format: <dir>/<name>/agent.toml + prompt.md
 * 2. Legacy markdown format: <dir>/<name>/SUBAGENT.md or AGENT.md
 * 3. Legacy flat markdown files: <dir>/<name>.md (for wrapped capabilities)
 */
export async function loadSubagents(
	capabilityPath: string,
	capabilityId: string,
): Promise<Subagent[]> {
	const subagents: Subagent[] = [];

	for (const dirName of POSSIBLE_DIR_NAMES) {
		const dir = join(capabilityPath, dirName);

		if (!existsSync(dir)) {
			continue;
		}

		const rootSubagent = await parseSubagentDirectory(dir, capabilityId);
		if (rootSubagent) {
			subagents.push(rootSubagent);
		}

		const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const subagent = await parseSubagentDirectory(join(dir, entry.name), capabilityId);
				if (subagent) {
					subagents.push(subagent);
				}
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				if (PROMPT_FILE_NAMES.includes(entry.name) || LEGACY_AGENT_FILES.includes(entry.name)) {
					continue;
				}

				const subagentPath = join(dir, entry.name);
				const content = await readFile(subagentPath, "utf-8");
				subagents.push(
					parseLegacySubagentMarkdown(
						content,
						capabilityId,
						subagentPath,
						basename(subagentPath, ".md"),
					),
				);
			}
		}
	}

	return subagents;
}

export function parseLegacySubagentMarkdown(
	content: string,
	capabilityId: string,
	sourceLabel: string,
	inferredName?: string,
): Subagent {
	const parsed = parseFrontmatterWithMarkdown<LegacySubagentFrontmatter>(content);

	if (!parsed) {
		throw new Error(`Invalid SUBAGENT.md format at ${sourceLabel}: missing YAML frontmatter`);
	}

	const frontmatter = parsed.frontmatter;
	const name =
		frontmatter.name ||
		inferredName?.replace(/^SUBAGENT$/i, "").replace(/^AGENT$/i, "") ||
		undefined;

	if (!name || !frontmatter.description) {
		throw new Error(`Invalid SUBAGENT.md at ${sourceLabel}: name and description required`);
	}

	const claude: ClaudeSubagentConfig = {};

	if (frontmatter.tools) {
		claude.tools = parseCommaSeparatedList(frontmatter.tools);
	}

	if (frontmatter.disallowedTools) {
		claude.disallowedTools = parseCommaSeparatedList(frontmatter.disallowedTools);
	}

	if (frontmatter.model) {
		claude.model = frontmatter.model;
	}

	if (frontmatter.permissionMode) {
		claude.permissionMode = frontmatter.permissionMode;
	}

	if (frontmatter.skills) {
		claude.skills = parseCommaSeparatedList(frontmatter.skills);
	}

	if (frontmatter.hooks) {
		claude.hooks = frontmatter.hooks;
	}

	const subagent: Subagent = {
		name,
		description: frontmatter.description,
		systemPrompt: parsed.markdown.trim(),
		capabilityId,
	};

	if (hasClaudeConfig(claude)) {
		subagent.claude = claude;
	}

	return withClaudeCompatibilityAliases(subagent);
}

export function parseSubagentManifest(
	agentTomlContent: string,
	promptContent: string,
	capabilityId: string,
	sourceLabel: string,
): Subagent {
	let parsed: SubagentManifest;

	try {
		parsed = parseToml(agentTomlContent) as SubagentManifest;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid agent.toml at ${sourceLabel}: ${message}`);
	}

	if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) {
		throw new Error(`Invalid agent.toml at ${sourceLabel}: name is required`);
	}

	if (typeof parsed.description !== "string" || parsed.description.trim().length === 0) {
		throw new Error(`Invalid agent.toml at ${sourceLabel}: description is required`);
	}

	const claude = parseClaudeConfig(parsed.claude, sourceLabel);
	const codex = parseCodexConfig(parsed.codex, sourceLabel);

	const subagent: Subagent = {
		name: parsed.name.trim(),
		description: parsed.description.trim(),
		systemPrompt: promptContent.trim(),
		capabilityId,
	};

	if (claude) {
		subagent.claude = claude;
	}

	if (codex) {
		subagent.codex = codex;
	}

	return withClaudeCompatibilityAliases(subagent);
}

async function parseSubagentDirectory(
	dirPath: string,
	capabilityId: string,
): Promise<Subagent | null> {
	const manifestPath = findFirstExisting(dirPath, MANIFEST_FILE_NAMES);
	const promptPath = findFirstExisting(dirPath, PROMPT_FILE_NAMES);

	if (manifestPath || promptPath) {
		if (!manifestPath || !promptPath) {
			throw new Error(
				`Invalid subagent directory at ${dirPath}: agent.toml and prompt.md must both be present`,
			);
		}

		const [agentTomlContent, promptContent] = await Promise.all([
			readFile(manifestPath, "utf-8"),
			readFile(promptPath, "utf-8"),
		]);

		return parseSubagentManifest(agentTomlContent, promptContent, capabilityId, manifestPath);
	}

	const legacyPath = findFirstExisting(dirPath, LEGACY_AGENT_FILES);
	if (!legacyPath) {
		return null;
	}

	const content = await readFile(legacyPath, "utf-8");
	return parseLegacySubagentMarkdown(content, capabilityId, legacyPath);
}

function findFirstExisting(dirPath: string, fileNames: string[]): string | null {
	for (const fileName of fileNames) {
		const filePath = join(dirPath, fileName);
		if (existsSync(filePath)) {
			return filePath;
		}
	}

	return null;
}

function parseClaudeConfig(value: SubagentManifest["claude"], sourceLabel: string) {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const claude: ClaudeSubagentConfig = {};

	if (value.tools !== undefined) {
		claude.tools = readStringArray(value.tools, `${sourceLabel} [claude].tools`);
	}

	if (value.disallowed_tools !== undefined) {
		claude.disallowedTools = readStringArray(
			value.disallowed_tools,
			`${sourceLabel} [claude].disallowed_tools`,
		);
	}

	if (value.model !== undefined) {
		claude.model = readEnum<SubagentModel>(
			value.model,
			["sonnet", "opus", "haiku", "inherit"],
			`${sourceLabel} [claude].model`,
		);
	}

	if (value.permission_mode !== undefined) {
		claude.permissionMode = readEnum<SubagentPermissionMode>(
			value.permission_mode,
			["default", "acceptEdits", "dontAsk", "bypassPermissions", "plan"],
			`${sourceLabel} [claude].permission_mode`,
		);
	}

	if (value.skills !== undefined) {
		claude.skills = readStringArray(value.skills, `${sourceLabel} [claude].skills`);
	}

	if (value.hooks !== undefined) {
		if (typeof value.hooks !== "object" || value.hooks === null) {
			throw new Error(`Invalid ${sourceLabel} [claude].hooks: expected a table`);
		}
		claude.hooks = value.hooks as SubagentHooks;
	}

	return hasClaudeConfig(claude) ? claude : undefined;
}

function parseCodexConfig(value: SubagentManifest["codex"], sourceLabel: string) {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const codex: CodexSubagentConfig = {};

	if (value.model !== undefined) {
		codex.model = readString(value.model, `${sourceLabel} [codex].model`);
	}

	if (value.model_reasoning_effort !== undefined) {
		codex.modelReasoningEffort = readEnum<CodexModelReasoningEffort>(
			value.model_reasoning_effort,
			["low", "medium", "high", "xhigh"],
			`${sourceLabel} [codex].model_reasoning_effort`,
		);
	}

	if (value.sandbox_mode !== undefined) {
		codex.sandboxMode = readEnum<CodexSandboxMode>(
			value.sandbox_mode,
			["read-only", "workspace-write", "danger-full-access"],
			`${sourceLabel} [codex].sandbox_mode`,
		);
	}

	if (value.nickname_candidates !== undefined) {
		codex.nicknameCandidates = readStringArray(
			value.nickname_candidates,
			`${sourceLabel} [codex].nickname_candidates`,
		);
	}

	return Object.keys(codex).length > 0 ? codex : undefined;
}

function withClaudeCompatibilityAliases(subagent: Subagent): Subagent {
	if (subagent.claude) {
		if (subagent.claude.tools) {
			subagent.tools = subagent.claude.tools;
		}
		if (subagent.claude.disallowedTools) {
			subagent.disallowedTools = subagent.claude.disallowedTools;
		}
		if (subagent.claude.model) {
			subagent.model = subagent.claude.model;
		}
		if (subagent.claude.permissionMode) {
			subagent.permissionMode = subagent.claude.permissionMode;
		}
		if (subagent.claude.skills) {
			subagent.skills = subagent.claude.skills;
		}
		if (subagent.claude.hooks) {
			subagent.hooks = subagent.claude.hooks;
		}
	}

	return subagent;
}

function hasClaudeConfig(config: ClaudeSubagentConfig): boolean {
	return Object.keys(config).length > 0;
}

function readString(value: unknown, fieldName: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Invalid ${fieldName}: expected a non-empty string`);
	}

	return value.trim();
}

function readStringArray(value: unknown, fieldName: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`Invalid ${fieldName}: expected an array of strings`);
	}

	return value.map((item) => item.trim()).filter(Boolean);
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fieldName: string): T {
	if (typeof value !== "string" || !allowed.includes(value as T)) {
		throw new Error(`Invalid ${fieldName}: expected one of ${allowed.join(", ")}`);
	}

	return value as T;
}

function parseCommaSeparatedList(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}
