import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { buildCapabilityRegistry } from "./capability/registry";
import { writeRules } from "./capability/rules";
import { fetchAllCapabilitySources } from "./capability/sources";
import { loadConfig } from "./config/loader";
import { syncMcpJson } from "./mcp-json/manager";
import {
	buildManifestFromCapabilities,
	cleanupStaleResources,
	loadManifest,
	saveManifest,
} from "./state/manifest";
import type { ProviderAdapter, ProviderContext, SyncBundle } from "./types";

export interface SyncResult {
	capabilities: string[];
	skillCount: number;
	ruleCount: number;
	docCount: number;
}

export interface SyncOptions {
	silent?: boolean;
	/** Optional list of adapters to run. If not provided, adapters are not run. */
	adapters?: ProviderAdapter[];
}

/**
 * Install dependencies for capabilities in .omni/capabilities/
 * Only installs for capabilities that have a package.json
 */
export async function installCapabilityDependencies(silent: boolean): Promise<void> {
	const { existsSync, readdirSync } = await import("node:fs");
	const { join } = await import("node:path");

	const capabilitiesDir = ".omni/capabilities";

	// Check if .omni/capabilities exists
	if (!existsSync(capabilitiesDir)) {
		return; // Nothing to install
	}

	const entries = readdirSync(capabilitiesDir, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const capabilityPath = join(capabilitiesDir, entry.name);
		const packageJsonPath = join(capabilityPath, "package.json");

		// Skip if no package.json
		if (!existsSync(packageJsonPath)) {
			continue;
		}

		if (!silent) {
			console.log(`Installing dependencies for ${capabilityPath}...`);
		}

		// Run bun install in the capability directory
		await new Promise<void>((resolve, reject) => {
			const proc = spawn("bun", ["install"], {
				cwd: capabilityPath,
				stdio: silent ? "ignore" : "inherit",
			});

			proc.on("close", (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`Failed to install dependencies for ${capabilityPath}`));
				}
			});

			proc.on("error", (error) => {
				reject(error);
			});
		});
	}
}

/**
 * Build a provider-agnostic SyncBundle from the capability registry.
 * This bundle can then be passed to adapters for provider-specific materialization.
 */
export async function buildSyncBundle(options?: {
	silent?: boolean;
}): Promise<{ bundle: SyncBundle }> {
	const silent = options?.silent ?? false;

	// Fetch capability sources from git repos FIRST (before discovery)
	const config = await loadConfig();
	await fetchAllCapabilitySources(config, { silent });

	// Install capability dependencies before building registry
	await installCapabilityDependencies(silent);

	// Build registry
	const registry = await buildCapabilityRegistry();
	const capabilities = registry.getAllCapabilities();
	const skills = registry.getAllSkills();
	const rules = registry.getAllRules();
	const docs = registry.getAllDocs();
	const commands = capabilities.flatMap((c) => c.commands);
	const subagents = capabilities.flatMap((c) => c.subagents);

	// Generate instructions content
	const instructionsContent = generateInstructionsContent(rules, docs);

	const bundle: SyncBundle = {
		capabilities,
		skills,
		rules,
		docs,
		commands,
		subagents,
		instructionsPath: ".omni/instructions.md",
		instructionsContent,
	};

	return { bundle };
}

/**
 * Central sync function that regenerates all agent configuration files.
 * Called automatically after any config change (init, capability enable/disable, profile change).
 *
 * If adapters are provided, they will be called after core sync to write provider-specific files.
 */
export async function syncAgentConfiguration(options?: SyncOptions): Promise<SyncResult> {
	const silent = options?.silent ?? false;
	const adapters = options?.adapters ?? [];

	if (!silent) {
		console.log("Syncing agent configuration...");
	}

	const { bundle } = await buildSyncBundle({ silent });
	const capabilities = bundle.capabilities;

	// Load previous manifest and cleanup stale resources from disabled capabilities
	const previousManifest = await loadManifest();
	const currentCapabilityIds = new Set(capabilities.map((c) => c.id));

	const cleanupResult = await cleanupStaleResources(previousManifest, currentCapabilityIds);

	if (
		!silent &&
		(cleanupResult.deletedSkills.length > 0 || cleanupResult.deletedRules.length > 0)
	) {
		console.log("Cleaned up stale resources:");
		if (cleanupResult.deletedSkills.length > 0) {
			console.log(
				`  - Removed ${cleanupResult.deletedSkills.length} skill(s): ${cleanupResult.deletedSkills.join(", ")}`,
			);
		}
		if (cleanupResult.deletedRules.length > 0) {
			console.log(
				`  - Removed ${cleanupResult.deletedRules.length} rule(s): ${cleanupResult.deletedRules.join(", ")}`,
			);
		}
	}

	// Call sync hooks for capabilities that have them
	for (const capability of capabilities) {
		// Check for structured export sync function first (new approach)
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic module exports need runtime type checking
		const defaultExport = (capability.exports as any).default;
		if (defaultExport && typeof defaultExport.sync === "function") {
			try {
				await defaultExport.sync();
			} catch (error) {
				console.error(`Error running sync hook for ${capability.id}:`, error);
			}
		}
		// Fall back to TOML-based sync hook (legacy approach)
		else if (capability.config.sync?.on_sync) {
			const syncFnName = capability.config.sync.on_sync;
			const syncFn = capability.exports[syncFnName];

			if (typeof syncFn === "function") {
				try {
					await syncFn();
				} catch (error) {
					console.error(`Error running sync hook for ${capability.id}:`, error);
				}
			}
		}
	}

	// Ensure core directories exist
	mkdirSync(".omni", { recursive: true });

	// Write rules and docs to .omni/instructions.md (provider-agnostic)
	await writeRules(bundle.rules, bundle.docs);

	// Sync .mcp.json with capability MCP servers (before saving manifest)
	await syncMcpJson(capabilities, previousManifest, { silent });

	// Save updated manifest for future cleanup
	const newManifest = buildManifestFromCapabilities(capabilities);
	await saveManifest(newManifest);

	// Run enabled adapters to write provider-specific files
	if (adapters.length > 0) {
		const config = await loadConfig();
		const ctx: ProviderContext = {
			projectRoot: process.cwd(),
			config,
		};

		for (const adapter of adapters) {
			try {
				const result = await adapter.sync(bundle, ctx);
				if (!silent && result.filesWritten.length > 0) {
					console.log(`  - ${adapter.displayName}: ${result.filesWritten.length} files`);
				}
			} catch (error) {
				console.error(`Error running ${adapter.displayName} adapter:`, error);
			}
		}
	}

	if (!silent) {
		console.log("✓ Synced:");
		console.log(
			`  - .omni/instructions.md (${bundle.docs.length} docs, ${bundle.rules.length} rules)`,
		);
		if (adapters.length > 0) {
			console.log(`  - Provider adapters: ${adapters.map((a) => a.displayName).join(", ")}`);
		}
	}

	return {
		capabilities: capabilities.map((c) => c.id),
		skillCount: bundle.skills.length,
		ruleCount: bundle.rules.length,
		docCount: bundle.docs.length,
	};
}

/**
 * Generate instructions.md content from rules and docs.
 */
function generateInstructionsContent(rules: SyncBundle["rules"], docs: SyncBundle["docs"]): string {
	if (rules.length === 0 && docs.length === 0) {
		return `## Capabilities

No capabilities enabled yet. Run \`omnidev capability enable <name>\` to enable capabilities.`;
	}

	let content = `## Capabilities

`;

	// Add documentation section if there are docs
	if (docs.length > 0) {
		content += `### Documentation

`;
		for (const doc of docs) {
			content += `#### ${doc.name} (from ${doc.capabilityId})

${doc.content}

`;
		}
	}

	// Add rules section if there are rules
	if (rules.length > 0) {
		content += `### Rules

`;
		for (const rule of rules) {
			content += `#### ${rule.name} (from ${rule.capabilityId})

${rule.content}

`;
		}
	}

	return content.trim();
}
