import { existsSync, mkdirSync, rmSync } from "node:fs";
import type { LoadedCapability } from "../types";

/**
 * Resources provided by a single capability
 */
export interface CapabilityResources {
	skills: string[];
	rules: string[];
	commands: string[];
	subagents: string[];
}

/**
 * Manifest tracking which resources each capability provides.
 * Used to clean up stale resources when capabilities are disabled.
 */
export interface ResourceManifest {
	/** Schema version for future migrations */
	version: 1;
	/** Last sync timestamp (ISO 8601) */
	syncedAt: string;
	/** Map of capability ID → resources it provides */
	capabilities: Record<string, CapabilityResources>;
}

/**
 * Result of cleaning up stale resources
 */
export interface CleanupResult {
	deletedSkills: string[];
	deletedRules: string[];
	deletedCommands: string[];
	deletedSubagents: string[];
}

const MANIFEST_PATH = ".omni/state/manifest.json";
const CURRENT_VERSION = 1;

/**
 * Load the previous manifest from disk.
 * Returns an empty manifest if the file doesn't exist.
 */
export async function loadManifest(): Promise<ResourceManifest> {
	if (!existsSync(MANIFEST_PATH)) {
		return {
			version: CURRENT_VERSION,
			syncedAt: new Date().toISOString(),
			capabilities: {},
		};
	}

	const content = await Bun.file(MANIFEST_PATH).text();
	return JSON.parse(content) as ResourceManifest;
}

/**
 * Save the manifest to disk.
 */
export async function saveManifest(manifest: ResourceManifest): Promise<void> {
	mkdirSync(".omni/state", { recursive: true });
	await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

/**
 * Build a manifest from the current registry capabilities.
 */
export function buildManifestFromCapabilities(capabilities: LoadedCapability[]): ResourceManifest {
	const manifest: ResourceManifest = {
		version: CURRENT_VERSION,
		syncedAt: new Date().toISOString(),
		capabilities: {},
	};

	for (const cap of capabilities) {
		manifest.capabilities[cap.id] = {
			skills: cap.skills.map((s) => s.name),
			rules: cap.rules.map((r) => r.name),
			commands: cap.commands.map((c) => c.name),
			subagents: cap.subagents.map((s) => s.name),
		};
	}

	return manifest;
}

/**
 * Delete resources for capabilities that are no longer enabled.
 * Compares the previous manifest against current capability IDs
 * and removes files/directories for capabilities not in the current set.
 */
export async function cleanupStaleResources(
	previousManifest: ResourceManifest,
	currentCapabilityIds: Set<string>,
): Promise<CleanupResult> {
	const result: CleanupResult = {
		deletedSkills: [],
		deletedRules: [],
		deletedCommands: [],
		deletedSubagents: [],
	};

	for (const [capId, resources] of Object.entries(previousManifest.capabilities)) {
		// Skip if capability is still enabled
		if (currentCapabilityIds.has(capId)) {
			continue;
		}

		// Delete skills (directories)
		for (const skillName of resources.skills) {
			const skillDir = `.claude/skills/${skillName}`;
			if (existsSync(skillDir)) {
				rmSync(skillDir, { recursive: true });
				result.deletedSkills.push(skillName);
			}
		}

		// Delete rules (individual files)
		for (const ruleName of resources.rules) {
			const rulePath = `.cursor/rules/omnidev-${ruleName}.mdc`;
			if (existsSync(rulePath)) {
				rmSync(rulePath);
				result.deletedRules.push(ruleName);
			}
		}

		// Future: Delete commands and subagents if they become file-based
	}

	return result;
}
