import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { LoadedCapability, ManagedOutput } from "../types";
import { getCapabilityMcpEntries } from "../capability/mcps";

/**
 * Resources provided by a single capability
 */
export interface CapabilityResources {
	skills: string[];
	rules: string[];
	commands: string[];
	subagents: string[];
	mcps: string[];
}

export interface ProviderManagedOutputs {
	outputs: Record<string, ManagedOutput>;
}

interface ResourceManifestV1 {
	version: 1;
	syncedAt: string;
	capabilities: Record<string, CapabilityResources>;
}

/**
 * Manifest tracking capability resources and provider-managed outputs.
 */
export interface ResourceManifest {
	/** Schema version for future migrations */
	version: 2;
	/** Last sync timestamp (ISO 8601) */
	syncedAt: string;
	/** Map of capability ID → resources it provides */
	capabilities: Record<string, CapabilityResources>;
	/** Map of provider ID → managed outputs */
	providers: Record<string, ProviderManagedOutputs>;
}

/**
 * Result of cleaning up stale resources
 */
export interface CleanupResult {
	deletedSkills: string[];
	deletedRules: string[];
	deletedCommands: string[];
	deletedSubagents: string[];
	deletedMcps: string[];
}

export interface ManagedOutputsCleanupResult {
	deletedPaths: string[];
	skippedPaths: Array<{ path: string; reason: string }>;
}

const MANIFEST_PATH = ".omni/state/manifest.json";
const CURRENT_VERSION = 2;

function createEmptyManifest(): ResourceManifest {
	return {
		version: CURRENT_VERSION,
		syncedAt: new Date().toISOString(),
		capabilities: {},
		providers: {},
	};
}

function normalizeManifest(parsed: ResourceManifest | ResourceManifestV1): ResourceManifest {
	if (parsed.version === CURRENT_VERSION && "providers" in parsed) {
		return {
			version: CURRENT_VERSION,
			syncedAt: parsed.syncedAt,
			capabilities: parsed.capabilities,
			providers: parsed.providers ?? {},
		};
	}

	return {
		version: CURRENT_VERSION,
		syncedAt: parsed.syncedAt,
		capabilities: parsed.capabilities,
		providers: {},
	};
}

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

function isDirectoryEmpty(path: string): boolean {
	return readdirSync(path).length === 0;
}

async function cleanupManagedOutput(
	output: ManagedOutput,
): Promise<{ deleted: boolean; reason?: string }> {
	const outputPath = join(process.cwd(), output.path);

	if (!existsSync(outputPath)) {
		return { deleted: false };
	}

	if (output.cleanupStrategy === "remove-json-key") {
		if (!output.jsonKey) {
			return { deleted: false, reason: `missing jsonKey metadata for ${output.path}` };
		}

		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(await readFile(outputPath, "utf-8")) as Record<string, unknown>;
		} catch {
			return { deleted: false, reason: `could not parse JSON at ${output.path}` };
		}

		const currentValue = parsed[output.jsonKey];
		if (currentValue === undefined) {
			return { deleted: false };
		}

		if (hashContent(JSON.stringify(currentValue)) !== output.hash) {
			return { deleted: false, reason: `managed section changed at ${output.path}` };
		}

		delete parsed[output.jsonKey];
		if (Object.keys(parsed).length === 0) {
			rmSync(outputPath);
		} else {
			await writeFile(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
		}

		return { deleted: true };
	}

	const currentContent = await readFile(outputPath, "utf-8");
	if (hashContent(currentContent) !== output.hash) {
		return { deleted: false, reason: `managed file changed at ${output.path}` };
	}

	rmSync(outputPath);

	if (output.cleanupStrategy === "delete-file-and-prune-empty-parents" && output.pruneRoot) {
		const pruneRoot = join(process.cwd(), output.pruneRoot);
		let currentDir = dirname(outputPath);

		while (
			normalizePath(currentDir).startsWith(normalizePath(pruneRoot)) &&
			normalizePath(currentDir) !== normalizePath(pruneRoot) &&
			existsSync(currentDir) &&
			isDirectoryEmpty(currentDir)
		) {
			rmSync(currentDir, { recursive: true });
			currentDir = dirname(currentDir);
		}
	}

	return { deleted: true };
}

/**
 * Load the previous manifest from disk.
 * Returns an empty manifest if the file doesn't exist.
 */
export async function loadManifest(): Promise<ResourceManifest> {
	if (!existsSync(MANIFEST_PATH)) {
		return createEmptyManifest();
	}

	const content = await readFile(MANIFEST_PATH, "utf-8");
	return normalizeManifest(JSON.parse(content) as ResourceManifest | ResourceManifestV1);
}

/**
 * Save the manifest to disk.
 */
export async function saveManifest(manifest: ResourceManifest): Promise<void> {
	mkdirSync(".omni/state", { recursive: true });
	await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

/**
 * Build a manifest from the current registry capabilities and provider outputs.
 */
export function buildManifestFromCapabilities(
	capabilities: LoadedCapability[],
	providerOutputs: Map<string, ManagedOutput[]> = new Map(),
): ResourceManifest {
	const manifest: ResourceManifest = {
		version: CURRENT_VERSION,
		syncedAt: new Date().toISOString(),
		capabilities: {},
		providers: {},
	};

	for (const cap of capabilities) {
		const resources: CapabilityResources = {
			skills: cap.skills.map((s) => s.name),
			rules: cap.rules.map((r) => r.name),
			commands: cap.commands.map((c) => c.name),
			subagents: cap.subagents.map((s) => s.name),
			mcps: getCapabilityMcpEntries(cap.id, cap.config).map((mcp) => mcp.name),
		};

		manifest.capabilities[cap.id] = resources;
	}

	for (const [providerId, outputs] of providerOutputs) {
		manifest.providers[providerId] = {
			outputs: Object.fromEntries(outputs.map((output) => [output.path, output])),
		};
	}

	return manifest;
}

/**
 * Delete resources for capabilities that are no longer enabled.
 * Provider-managed outputs are now cleaned via the providers manifest.
 */
export async function cleanupStaleResources(
	_previousManifest: ResourceManifest,
	_currentCapabilityIds: Set<string>,
): Promise<CleanupResult> {
	return {
		deletedSkills: [],
		deletedRules: [],
		deletedCommands: [],
		deletedSubagents: [],
		deletedMcps: [],
	};
}

export async function cleanupStaleManagedOutputs(
	previousManifest: ResourceManifest,
	nextProviders: Map<string, ManagedOutput[]>,
): Promise<ManagedOutputsCleanupResult> {
	const result: ManagedOutputsCleanupResult = {
		deletedPaths: [],
		skippedPaths: [],
	};

	const claimedPaths = new Set<string>();
	for (const outputs of nextProviders.values()) {
		for (const output of outputs) {
			claimedPaths.add(output.path);
		}
	}

	for (const [providerId, providerState] of Object.entries(previousManifest.providers)) {
		const nextPaths = new Set((nextProviders.get(providerId) ?? []).map((output) => output.path));

		for (const output of Object.values(providerState.outputs)) {
			if (nextPaths.has(output.path)) {
				continue;
			}

			if (claimedPaths.has(output.path)) {
				continue;
			}

			const cleanup = await cleanupManagedOutput(output);
			if (cleanup.deleted) {
				result.deletedPaths.push(output.path);
			} else if (cleanup.reason) {
				result.skippedPaths.push({
					path: output.path,
					reason: cleanup.reason,
				});
			}
		}
	}

	return result;
}

export function getProviderManagedOutputs(
	manifest: ResourceManifest,
	providerId: string,
): ManagedOutput[] {
	return Object.values(manifest.providers[providerId]?.outputs ?? {});
}
