import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateEnv } from "../config/env";
import { parseCapabilityConfig } from "../config/parser";
import type { CapabilityConfig, LoadedCapability } from "../types";
import { loadDocs } from "./docs";
import { loadRules } from "./rules";
import { loadSkills } from "./skills";

const CAPABILITIES_DIR = ".omni/capabilities";

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
	if (!existsSync(CAPABILITIES_DIR)) {
		return [];
	}

	const entries = readdirSync(CAPABILITIES_DIR, { withFileTypes: true });
	const capabilities: string[] = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const configPath = join(CAPABILITIES_DIR, entry.name, "capability.toml");
			if (existsSync(configPath)) {
				capabilities.push(join(CAPABILITIES_DIR, entry.name));
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
			? (exportsAny.skills as LoadedCapability["skills"])
			: await loadSkills(capabilityPath, id);

	const rules =
		"rules" in exports && Array.isArray(exportsAny.rules)
			? (exportsAny.rules as LoadedCapability["rules"])
			: await loadRules(capabilityPath, id);

	const docs =
		"docs" in exports && Array.isArray(exportsAny.docs)
			? (exportsAny.docs as LoadedCapability["docs"])
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
