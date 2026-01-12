import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateEnv } from "../config/env";
import { parseCapabilityConfig } from "../config/parser";
import type {
	CapabilityConfig,
	Command,
	Doc,
	LoadedCapability,
	Rule,
	Skill,
	Subagent,
} from "../types";
import type {
	CommandExport,
	DocExport,
	SkillExport,
	SubagentExport,
} from "../types/capability-export";
import { loadCommands } from "./commands";
import { loadDocs } from "./docs";
import { loadRules } from "./rules";
import { loadSkills } from "./skills";
import { loadSubagents } from "./subagents";

const CAPABILITIES_DIR = ".omni/capabilities";
const BUILTIN_CAPABILITIES_DIR = "capabilities";

/**
 * Reserved capability names that cannot be used.
 * These are common package names that might conflict with imports.
 */
const RESERVED_NAMES = [
	"fs",
	"path",
	"http",
	"https",
	"crypto",
	"os",
	"child_process",
	"stream",
	"buffer",
	"util",
	"events",
	"net",
	"url",
	"querystring",
	"react",
	"vue",
	"lodash",
	"axios",
	"express",
	"typescript",
];

/**
 * Discovers capabilities by scanning the .omni/capabilities directory.
 * A directory is considered a capability if it contains a capability.toml file.
 *
 * @returns Array of capability directory paths
 */
export async function discoverCapabilities(): Promise<string[]> {
	const capabilities: string[] = [];

	// Discover built-in capabilities (from capabilities/ directory)
	if (existsSync(BUILTIN_CAPABILITIES_DIR)) {
		const entries = readdirSync(BUILTIN_CAPABILITIES_DIR, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const configPath = join(BUILTIN_CAPABILITIES_DIR, entry.name, "capability.toml");
				if (existsSync(configPath)) {
					capabilities.push(join(BUILTIN_CAPABILITIES_DIR, entry.name));
				}
			}
		}
	}

	// Discover project-specific capabilities (from .omni/capabilities/)
	if (existsSync(CAPABILITIES_DIR)) {
		const entries = readdirSync(CAPABILITIES_DIR, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const configPath = join(CAPABILITIES_DIR, entry.name, "capability.toml");
				if (existsSync(configPath)) {
					capabilities.push(join(CAPABILITIES_DIR, entry.name));
				}
			}
		}
	}

	return capabilities;
}

/**
 * Loads and parses a capability configuration file.
 * Validates required fields and checks for reserved names.
 *
 * @param capabilityPath - Path to the capability directory
 * @returns Parsed capability configuration
 * @throws Error if the config is invalid or uses a reserved name
 */
export async function loadCapabilityConfig(capabilityPath: string): Promise<CapabilityConfig> {
	const configPath = join(capabilityPath, "capability.toml");
	const content = await Bun.file(configPath).text();
	const config = parseCapabilityConfig(content);

	// Validate name is not reserved
	if (RESERVED_NAMES.includes(config.capability.id)) {
		throw new Error(
			`Capability name "${config.capability.id}" is reserved. Choose a different name.`,
		);
	}

	return config;
}

/**
 * Dynamically imports capability exports from index.ts.
 * Returns an empty object if index.ts doesn't exist.
 *
 * @param capabilityPath - Path to the capability directory
 * @returns Exported module or empty object
 * @throws Error if import fails
 */
async function importCapabilityExports(capabilityPath: string): Promise<Record<string, unknown>> {
	const indexPath = join(capabilityPath, "index.ts");

	if (!existsSync(indexPath)) {
		return {};
	}

	try {
		const absolutePath = join(process.cwd(), indexPath);
		const module = await import(absolutePath);
		return module;
	} catch (error) {
		// Check if it's a module resolution error
		const errorMessage = String(error);
		if (errorMessage.includes("Cannot find module")) {
			const match = errorMessage.match(/Cannot find module '([^']+)'/);
			const missingModule = match ? match[1] : "unknown";
			throw new Error(
				`Missing dependency '${missingModule}' for capability at ${capabilityPath}.\n` +
					`If this is a project-specific capability, install dependencies or remove it from .omni/capabilities/`,
			);
		}
		throw new Error(`Failed to import capability at ${capabilityPath}: ${error}`);
	}
}

/**
 * Loads type definitions from types.d.ts if it exists.
 *
 * @param capabilityPath - Path to the capability directory
 * @returns Type definitions as string or undefined
 */
async function loadTypeDefinitions(capabilityPath: string): Promise<string | undefined> {
	const typesPath = join(capabilityPath, "types.d.ts");

	if (!existsSync(typesPath)) {
		return undefined;
	}

	return Bun.file(typesPath).text();
}

/**
 * Convert programmatic skill exports to Skill objects
 * Expects SkillExport format with skillMd (markdown with YAML frontmatter)
 */
function convertSkillExports(skillExports: unknown[], capabilityId: string): Skill[] {
	return skillExports.map((skillExport) => {
		const exportObj = skillExport as SkillExport;
		const lines = exportObj.skillMd.split("\n");
		let name = "unnamed";
		let description = "";
		let instructions = exportObj.skillMd;

		// Simple YAML frontmatter parser
		if (lines[0]?.trim() === "---") {
			const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
			if (endIndex > 0) {
				const frontmatter = lines.slice(1, endIndex);
				instructions = lines
					.slice(endIndex + 1)
					.join("\n")
					.trim();

				for (const line of frontmatter) {
					const match = line.match(/^(\w+):\s*(.+)$/);
					if (match?.[1] && match[2]) {
						const key = match[1];
						const value = match[2];
						if (key === "name") {
							name = value.replace(/^["']|["']$/g, "");
						} else if (key === "description") {
							description = value.replace(/^["']|["']$/g, "");
						}
					}
				}
			}
		}

		return {
			name,
			description,
			instructions,
			capabilityId,
		};
	});
}

/**
 * Convert programmatic rule exports to Rule objects
 * Expects array of string content (markdown)
 */
function convertRuleExports(ruleExports: unknown[], capabilityId: string): Rule[] {
	return ruleExports.map((ruleExport, index) => {
		return {
			name: `rule-${index + 1}`,
			content: String(ruleExport).trim(),
			capabilityId,
		};
	});
}

/**
 * Convert programmatic doc exports to Doc objects
 * Expects DocExport format with title and content
 */
function convertDocExports(docExports: unknown[], capabilityId: string): Doc[] {
	return docExports.map((docExport) => {
		const exportObj = docExport as DocExport;
		return {
			name: exportObj.title,
			content: exportObj.content.trim(),
			capabilityId,
		};
	});
}

/**
 * Convert programmatic subagent exports to Subagent objects
 * Parses SubagentExport markdown with YAML frontmatter
 */
function convertSubagentExports(subagentExports: unknown[], capabilityId: string): Subagent[] {
	return subagentExports.map((subagentExport) => {
		const exportObj = subagentExport as SubagentExport;
		const lines = exportObj.subagentMd.split("\n");
		let name = "unnamed";
		let description = "";
		let systemPrompt = exportObj.subagentMd;
		let tools: string[] | undefined;
		let disallowedTools: string[] | undefined;
		let model: string | undefined;
		let permissionMode: string | undefined;
		let skills: string[] | undefined;

		// Simple YAML frontmatter parser
		if (lines[0]?.trim() === "---") {
			const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
			if (endIndex > 0) {
				const frontmatter = lines.slice(1, endIndex);
				systemPrompt = lines
					.slice(endIndex + 1)
					.join("\n")
					.trim();

				for (const line of frontmatter) {
					const match = line.match(/^(\w+):\s*(.+)$/);
					if (match?.[1] && match[2]) {
						const key = match[1];
						const value = match[2].replace(/^["']|["']$/g, "");
						switch (key) {
							case "name":
								name = value;
								break;
							case "description":
								description = value;
								break;
							case "tools":
								tools = value.split(",").map((t) => t.trim());
								break;
							case "disallowedTools":
								disallowedTools = value.split(",").map((t) => t.trim());
								break;
							case "model":
								model = value;
								break;
							case "permissionMode":
								permissionMode = value;
								break;
							case "skills":
								skills = value.split(",").map((s) => s.trim());
								break;
						}
					}
				}
			}
		}

		const result: Subagent = {
			name,
			description,
			systemPrompt,
			capabilityId,
		};

		if (tools) result.tools = tools;
		if (disallowedTools) result.disallowedTools = disallowedTools;
		if (model) {
			result.model = model as NonNullable<Subagent["model"]>;
		}
		if (permissionMode) {
			result.permissionMode = permissionMode as NonNullable<Subagent["permissionMode"]>;
		}
		if (skills) result.skills = skills;

		return result;
	});
}

/**
 * Convert programmatic command exports to Command objects
 * Parses CommandExport markdown with YAML frontmatter
 */
function convertCommandExports(commandExports: unknown[], capabilityId: string): Command[] {
	return commandExports.map((commandExport) => {
		const exportObj = commandExport as CommandExport;
		const lines = exportObj.commandMd.split("\n");
		let name = "unnamed";
		let description = "";
		let prompt = exportObj.commandMd;
		let allowedTools: string | undefined;

		// Simple YAML frontmatter parser
		if (lines[0]?.trim() === "---") {
			const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
			if (endIndex > 0) {
				const frontmatter = lines.slice(1, endIndex);
				prompt = lines
					.slice(endIndex + 1)
					.join("\n")
					.trim();

				for (const line of frontmatter) {
					const match = line.match(/^(\w+):\s*(.+)$/);
					if (match?.[1] && match[2]) {
						const key = match[1];
						const value = match[2].replace(/^["']|["']$/g, "");
						switch (key) {
							case "name":
								name = value;
								break;
							case "description":
								description = value;
								break;
							case "allowedTools":
							case "allowed-tools":
								allowedTools = value;
								break;
						}
					}
				}
			}
		}

		const result: Command = {
			name,
			description,
			prompt,
			capabilityId,
		};

		if (allowedTools) {
			result.allowedTools = allowedTools;
		}

		return result;
	});
}

/**
 * Loads a complete capability including config, skills, rules, docs, and exports.
 * Validates environment requirements before loading.
 *
 * @param capabilityPath - Path to the capability directory
 * @param env - Environment variables to validate against
 * @returns Fully loaded capability
 * @throws Error if validation fails or loading errors occur
 */
export async function loadCapability(
	capabilityPath: string,
	env: Record<string, string>,
): Promise<LoadedCapability> {
	const config = await loadCapabilityConfig(capabilityPath);
	const id = config.capability.id;

	// Validate environment
	if (config.env) {
		validateEnv(config.env, env, id);
	}

	// Load content - programmatic takes precedence
	const exports = await importCapabilityExports(capabilityPath);

	// Check if exports contains programmatic skills/rules/docs
	// biome-ignore lint/suspicious/noExplicitAny: Dynamic module exports need runtime type checking
	const exportsAny = exports as any;

	const skills =
		"skills" in exports && Array.isArray(exportsAny.skills)
			? convertSkillExports(exportsAny.skills, id)
			: await loadSkills(capabilityPath, id);

	const rules =
		"rules" in exports && Array.isArray(exportsAny.rules)
			? convertRuleExports(exportsAny.rules, id)
			: await loadRules(capabilityPath, id);

	const docs =
		"docs" in exports && Array.isArray(exportsAny.docs)
			? convertDocExports(exportsAny.docs, id)
			: await loadDocs(capabilityPath, id);

	const subagents =
		"subagents" in exports && Array.isArray(exportsAny.subagents)
			? convertSubagentExports(exportsAny.subagents, id)
			: await loadSubagents(capabilityPath, id);

	const commands =
		"commands" in exports && Array.isArray(exportsAny.commands)
			? convertCommandExports(exportsAny.commands, id)
			: await loadCommands(capabilityPath, id);

	const typeDefinitionsFromExports =
		"typeDefinitions" in exports && typeof exportsAny.typeDefinitions === "string"
			? (exportsAny.typeDefinitions as string)
			: undefined;

	const typeDefinitions =
		typeDefinitionsFromExports !== undefined
			? typeDefinitionsFromExports
			: await loadTypeDefinitions(capabilityPath);

	// Extract gitignore patterns from exports
	const gitignore =
		"gitignore" in exports && Array.isArray(exportsAny.gitignore)
			? (exportsAny.gitignore as string[])
			: undefined;

	// Build result object with explicit handling for optional typeDefinitions
	const result: LoadedCapability = {
		id,
		path: capabilityPath,
		config,
		skills,
		rules,
		docs,
		subagents,
		commands,
		exports,
	};

	// Only add typeDefinitions if it exists
	if (typeDefinitions !== undefined) {
		result.typeDefinitions = typeDefinitions;
	}

	// Only add gitignore if it exists
	if (gitignore !== undefined) {
		result.gitignore = gitignore;
	}

	return result;
}
