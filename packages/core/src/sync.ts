import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildCapabilityRegistry } from "./capability/registry";
import { writeRules } from "./capability/rules";
import { fetchAllCapabilitySources } from "./capability/sources";
import { loadConfig } from "./config/loader";
import { rebuildGitignore } from "./gitignore/manager";

export interface SyncResult {
	capabilities: string[];
	skillCount: number;
	ruleCount: number;
	docCount: number;
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
 * Central sync function that regenerates all agent configuration files
 * Called automatically after any config change (init, capability enable/disable, profile change)
 */
export async function syncAgentConfiguration(options?: { silent?: boolean }): Promise<SyncResult> {
	const silent = options?.silent ?? false;

	if (!silent) {
		console.log("Syncing agent configuration...");
	}

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

	// Rebuild .omni/.gitignore with all enabled capability patterns
	const gitignorePatterns = new Map<string, string[]>();
	for (const capability of capabilities) {
		if (capability.gitignore && capability.gitignore.length > 0) {
			gitignorePatterns.set(capability.id, capability.gitignore);
		}
	}
	await rebuildGitignore(gitignorePatterns);

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

	// Ensure directories exist
	mkdirSync(".claude/skills", { recursive: true });
	mkdirSync(".cursor/rules", { recursive: true });

	// Write rules and docs to .omni/instructions.md
	await writeRules(rules, docs);

	// Write skills to .claude/skills/
	for (const skill of skills) {
		const skillDir = `.claude/skills/${skill.name}`;
		mkdirSync(skillDir, { recursive: true });
		await Bun.write(
			join(skillDir, "SKILL.md"),
			`---
name: ${skill.name}
description: "${skill.description}"
---

${skill.instructions}`,
		);
	}

	// Write rules to .cursor/rules/
	for (const rule of rules) {
		await Bun.write(`.cursor/rules/omnidev-${rule.name}.mdc`, rule.content);
	}

	if (!silent) {
		console.log("✓ Synced:");
		console.log("  - .omni/.gitignore (capability patterns)");
		console.log(`  - .omni/instructions.md (${docs.length} docs, ${rules.length} rules)`);
		console.log(`  - .claude/skills/ (${skills.length} skills)`);
		console.log(`  - .cursor/rules/ (${rules.length} rules)`);
	}

	return {
		capabilities: capabilities.map((c) => c.id),
		skillCount: skills.length,
		ruleCount: rules.length,
		docCount: docs.length,
	};
}
