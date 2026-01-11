import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateEnv } from "../config/env";
import { parseCapabilityConfig } from "../config/parser";
import type { CapabilityConfig, Doc, LoadedCapability, Rule, Skill } from "../types";
import type { DocExport, SkillExport } from "../types/capability-export";
import { loadDocs } from "./docs";
import { loadRules } from "./rules";
import { loadSkills } from "./skills";

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
 * Supports both old format (Skill objects) and new format (SkillExport objects)
 */
function convertSkillExports(skillExports: unknown[], capabilityId: string): Skill[] {
	return skillExports.map((skillExport) => {
		// Check if it's already a Skill object (old format)
		if (
			typeof skillExport === "object" &&
			skillExport !== null &&
			"name" in skillExport &&
			"instructions" in skillExport
		) {
			return skillExport as Skill;
		}

		// Otherwise, treat as SkillExport (new format)
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
 * Supports both old format (Rule objects) and new format (string content)
 */
function convertRuleExports(ruleExports: unknown[], capabilityId: string): Rule[] {
	return ruleExports.map((ruleExport, index) => {
		// Check if it's already a Rule object (old format)
		if (
			typeof ruleExport === "object" &&
			ruleExport !== null &&
			"name" in ruleExport &&
			"content" in ruleExport
		) {
			return ruleExport as Rule;
		}

		// Otherwise, treat as string content (new format)
		return {
			name: `rule-${index + 1}`,
			content: String(ruleExport).trim(),
			capabilityId,
		};
	});
}

/**
 * Convert programmatic doc exports to Doc objects
 * Supports both old format (Doc objects) and new format (DocExport objects)
 */
function convertDocExports(docExports: unknown[], capabilityId: string): Doc[] {
	return docExports.map((docExport) => {
		// Check if it's already a Doc object (old format)
		if (
			typeof docExport === "object" &&
			docExport !== null &&
			"name" in docExport &&
			"content" in docExport
		) {
			return docExport as Doc;
		}

		// Otherwise, treat as DocExport (new format with 'title' instead of 'name')
		const exportObj = docExport as DocExport;
		return {
			name: exportObj.title,
			content: exportObj.content.trim(),
			capabilityId,
		};
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
