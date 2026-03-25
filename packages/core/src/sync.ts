import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCapabilityRegistry } from "./capability/registry";
import { fetchAllCapabilitySources, type SyncWarning } from "./capability/sources";
import { loadConfig } from "./config/config";
import { hasAnyHooks } from "./hooks/merger";
import { syncMcpJson } from "./mcp-json/manager";
import {
	buildManifestFromCapabilities,
	cleanupStaleManagedOutputs,
	cleanupStaleResources,
	getProviderManagedOutputs,
	loadManifest,
	saveManifest,
} from "./state/manifest";
import type { ManagedOutput, ProviderAdapter, ProviderContext, SyncBundle } from "./types";

export interface SyncResult {
	capabilities: string[];
	skillCount: number;
	ruleCount: number;
	docCount: number;
	/** Warnings about version mismatches, missing versions, etc. */
	warnings?: SyncWarning[];
}

export interface SyncOptions {
	silent?: boolean;
	/** Optional list of adapters to run. If not provided, adapters are not run. */
	adapters?: ProviderAdapter[];
}

interface InstallCommand {
	cmd: "npm";
	args: string[];
}

function getDeclaredPackageManager(packageManager: unknown): string | undefined {
	if (typeof packageManager !== "string" || packageManager.trim().length === 0) {
		return undefined;
	}

	const atIndex = packageManager.indexOf("@");
	return atIndex === -1 ? packageManager : packageManager.slice(0, atIndex);
}

export function resolveCapabilityInstallCommand(
	capabilityPath: string,
	options: { hasNpm: boolean },
): InstallCommand {
	const packageJsonPath = join(capabilityPath, "package.json");
	const packageLockPath = join(capabilityPath, "package-lock.json");

	let packageManager: string | undefined;
	try {
		const pkgJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
			packageManager?: unknown;
		};
		packageManager = getDeclaredPackageManager(pkgJson.packageManager);
	} catch {
		// Ignore parse errors and fall back to lockfile/availability based detection.
	}

	if (!options.hasNpm) {
		throw new Error("npm is not installed. Install npm to install capability dependencies.");
	}

	if (packageManager && packageManager !== "npm") {
		throw new Error(
			`Capability at ${capabilityPath} declares packageManager=${packageManager}, but OmniDev only supports npm for capability dependencies.`,
		);
	}

	return {
		cmd: "npm",
		args: [existsSync(packageLockPath) ? "ci" : "install"],
	};
}

/**
 * Install dependencies and build TypeScript capabilities in .omni/capabilities/
 * Only processes capabilities that have a package.json and are not wrapped.
 * Wrapped capabilities are auto-generated from external sources and their
 * package.json dependencies are not relevant to the capability itself.
 */
export async function installCapabilityDependencies(silent: boolean): Promise<void> {
	const { readdirSync } = await import("node:fs");
	const { parse } = await import("smol-toml");

	const capabilitiesDir = ".omni/capabilities";

	// Check if .omni/capabilities exists
	if (!existsSync(capabilitiesDir)) {
		return; // Nothing to install
	}

	const entries = readdirSync(capabilitiesDir, { withFileTypes: true });

	async function commandExists(cmd: string): Promise<boolean> {
		return await new Promise((resolve) => {
			const proc = spawn(cmd, ["--version"], { stdio: "ignore" });
			proc.on("error", () => resolve(false));
			proc.on("close", (code) => resolve(code === 0));
		});
	}

	const hasNpm = await commandExists("npm");

	if (!hasNpm) {
		throw new Error("npm is not installed. Install npm to install capability dependencies.");
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const capabilityPath = join(capabilitiesDir, entry.name);
		const packageJsonPath = join(capabilityPath, "package.json");
		const capabilityTomlPath = join(capabilityPath, "capability.toml");

		// Skip if no package.json
		if (!existsSync(packageJsonPath)) {
			continue;
		}

		// Skip wrapped capabilities - their package.json dependencies are from
		// the original source and are not relevant to the generated capability
		if (existsSync(capabilityTomlPath)) {
			try {
				const tomlContent = readFileSync(capabilityTomlPath, "utf-8");
				const parsed = parse(tomlContent) as {
					capability?: { metadata?: { wrapped?: boolean } };
				};
				if (parsed.capability?.metadata?.wrapped === true) {
					continue;
				}
			} catch {
				// If we can't parse capability.toml, continue with installation
			}
		}

		try {
			// Install dependencies silently (only show errors)
			await new Promise<void>((resolve, reject) => {
				const { cmd, args } = resolveCapabilityInstallCommand(capabilityPath, {
					hasNpm,
				});

				const proc = spawn(cmd, args, {
					cwd: capabilityPath,
					stdio: "pipe",
				});

				let stderr = "";
				proc.stderr?.on("data", (data) => {
					stderr += data.toString();
				});

				proc.on("close", (code) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`Failed to install dependencies for ${capabilityPath}:\n${stderr}`));
					}
				});

				proc.on("error", (error) => {
					reject(error);
				});
			});

			// Check if capability has a build script - always rebuild to ensure latest changes
			const hasIndexTs = existsSync(join(capabilityPath, "index.ts"));
			let hasBuildScript = false;
			try {
				const pkgJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
				hasBuildScript = Boolean(pkgJson.scripts?.build);
			} catch {
				// Ignore parse errors
			}

			if (hasBuildScript) {
				// Always rebuild capabilities with build scripts to ensure latest changes
				await new Promise<void>((resolve, reject) => {
					const proc = spawn("npm", ["run", "build"], {
						cwd: capabilityPath,
						stdio: "pipe",
					});

					let stderr = "";
					proc.stderr?.on("data", (data) => {
						stderr += data.toString();
					});

					proc.on("close", (code) => {
						if (code === 0) {
							resolve();
						} else {
							reject(new Error(`Failed to build capability ${capabilityPath}:\n${stderr}`));
						}
					});

					proc.on("error", (error) => {
						reject(error);
					});
				});
			} else if (hasIndexTs && !silent) {
				// Warn user that capability has TypeScript but no build setup
				const hasBuiltIndex = existsSync(join(capabilityPath, "dist", "index.js"));
				if (!hasBuiltIndex) {
					console.warn(
						`Warning: Capability at ${capabilityPath} has index.ts but no build script.\n` +
							`  Add a "build" script to package.json (e.g., "build": "tsc") to compile TypeScript.`,
					);
				}
			}
		} catch (error) {
			// Log warning but continue with other capabilities
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn(`Warning: ${errorMessage}`);
		}
	}
}

/**
 * Build a provider-agnostic SyncBundle from the capability registry.
 * This bundle can then be passed to adapters for provider-specific materialization.
 */
export async function buildSyncBundle(options?: {
	silent?: boolean;
}): Promise<{ bundle: SyncBundle; warnings: SyncWarning[] }> {
	const silent = options?.silent ?? false;

	// Fetch capability sources from git repos FIRST (before discovery)
	const config = await loadConfig();
	const fetchResult = await fetchAllCapabilitySources(config, { silent });
	const warnings = fetchResult.warnings;

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

	// Get merged hooks from all capabilities
	const mergedHooks = registry.getMergedHooks();

	// Generate instructions content
	const instructionsContent = generateInstructionsContent(rules, docs);

	const bundle: SyncBundle = {
		capabilities,
		skills,
		rules,
		docs,
		commands,
		subagents,
		instructionsContent,
	};

	// Only add hooks if there are any
	if (hasAnyHooks(mergedHooks)) {
		bundle.hooks = mergedHooks;
	}

	return { bundle, warnings };
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

	const { bundle, warnings } = await buildSyncBundle({ silent });
	const capabilities = bundle.capabilities;

	// Load previous manifest and cleanup stale resources from disabled capabilities
	const previousManifest = await loadManifest();
	const currentCapabilityIds = new Set(capabilities.map((c) => c.id));

	await cleanupStaleResources(previousManifest, currentCapabilityIds);

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

	// Sync .mcp.json with capability MCP servers (before saving manifest)
	await syncMcpJson(capabilities, previousManifest);

	// Run enabled adapters to write provider-specific files
	const enabledProviderIds = new Set(adapters.map((adapter) => String(adapter.id)));
	const successfulProviderOutputs = new Map<string, ManagedOutput[]>();

	if (adapters.length > 0) {
		const config = await loadConfig();
		const ctx: ProviderContext = {
			projectRoot: process.cwd(),
			config,
		};

		for (const adapter of adapters) {
			try {
				const adapterResult = await adapter.sync(bundle, ctx);
				successfulProviderOutputs.set(String(adapter.id), adapterResult.managedOutputs ?? []);
			} catch (error) {
				console.error(`Error running ${adapter.displayName} adapter:`, error);
			}
		}
	}

	const nextProviderOutputs = new Map<string, ManagedOutput[]>();
	if (adapters.length === 0) {
		for (const providerId of Object.keys(previousManifest.providers)) {
			nextProviderOutputs.set(providerId, getProviderManagedOutputs(previousManifest, providerId));
		}
	} else {
		for (const providerId of enabledProviderIds) {
			if (successfulProviderOutputs.has(providerId)) {
				nextProviderOutputs.set(providerId, successfulProviderOutputs.get(providerId) ?? []);
				continue;
			}

			nextProviderOutputs.set(providerId, getProviderManagedOutputs(previousManifest, providerId));
		}
	}

	const cleanupResult = await cleanupStaleManagedOutputs(previousManifest, nextProviderOutputs);
	for (const skipped of cleanupResult.skippedPaths) {
		console.warn(`Warning: skipped cleanup for ${skipped.path} (${skipped.reason})`);
	}

	// Save updated manifest for future cleanup
	const newManifest = buildManifestFromCapabilities(capabilities, nextProviderOutputs);
	await saveManifest(newManifest);

	const result: SyncResult = {
		capabilities: capabilities.map((c) => c.id),
		skillCount: bundle.skills.length,
		ruleCount: bundle.rules.length,
		docCount: bundle.docs.length,
	};

	// Only include warnings if there are any
	if (warnings.length > 0) {
		result.warnings = warnings;
	}

	return result;
}

/**
 * Generate instructions.md content from rules.
 */
function generateInstructionsContent(
	rules: SyncBundle["rules"],
	_docs: SyncBundle["docs"],
): string {
	if (rules.length === 0) {
		return "";
	}

	let content = `## Rules

`;

	for (const rule of rules) {
		content += `${rule.content}

`;
	}

	return content.trim();
}
