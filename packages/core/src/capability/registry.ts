import { getEnabledCapabilities } from "../config/capabilities";
import { loadEnvironment } from "../config/env";
import { mergeHooksConfigs } from "../hooks/merger.js";
import type { HooksConfig, CapabilityHooks, Doc, LoadedCapability, Rule, Skill } from "../types";
import { discoverCapabilities, loadCapability } from "./loader";

/**
 * Registry of loaded capabilities with helper functions.
 */
export interface CapabilityRegistry {
	capabilities: Map<string, LoadedCapability>;
	getCapability(id: string): LoadedCapability | undefined;
	getAllCapabilities(): LoadedCapability[];
	getAllSkills(): Skill[];
	getAllRules(): Rule[];
	getAllDocs(): Doc[];
	/** Get all capability hooks metadata */
	getAllCapabilityHooks(): CapabilityHooks[];
	/** Get merged hooks from all capabilities */
	getMergedHooks(): HooksConfig;
}

/**
 * Builds a capability registry by discovering, loading, and filtering capabilities.
 * Only enabled capabilities (based on active profile) are included.
 *
 * @returns Capability registry with helper functions
 */
export async function buildCapabilityRegistry(): Promise<CapabilityRegistry> {
	const env = await loadEnvironment();
	const enabledIds = await getEnabledCapabilities();

	const capabilityPaths = await discoverCapabilities();
	const capabilities = new Map<string, LoadedCapability>();

	for (const path of capabilityPaths) {
		try {
			const cap = await loadCapability(path, env);

			// Only add if enabled
			if (enabledIds.includes(cap.id)) {
				capabilities.set(cap.id, cap);
			}
		} catch (error) {
			// Extract just the error message without stack trace for cleaner output
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn(`Warning: Skipping capability at ${path}`);
			console.warn(`  ${errorMessage}`);
		}
	}

	// Helper to get all capability hooks
	const getAllCapabilityHooks = (): CapabilityHooks[] => {
		const hooks: CapabilityHooks[] = [];
		for (const cap of capabilities.values()) {
			if (cap.hooks) {
				hooks.push(cap.hooks);
			}
		}
		return hooks;
	};

	return {
		capabilities,
		getCapability: (id: string) => capabilities.get(id),
		getAllCapabilities: () => [...capabilities.values()],
		getAllSkills: () => [...capabilities.values()].flatMap((c) => c.skills),
		getAllRules: () => [...capabilities.values()].flatMap((c) => c.rules),
		getAllDocs: () => [...capabilities.values()].flatMap((c) => c.docs),
		getAllCapabilityHooks,
		getMergedHooks: () => mergeHooksConfigs(getAllCapabilityHooks()),
	};
}
