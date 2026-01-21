/**
 * Security allows state management
 *
 * Stores allowed (ignored) security warnings in .omni/security.json
 * This allows users to suppress specific findings they've reviewed and accepted.
 */

import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { FindingType } from "../security/types.js";

const OMNI_DIR = ".omni";
const SECURITY_PATH = `${OMNI_DIR}/security.json`;

/**
 * Security allows state structure
 */
export interface SecurityAllowsState {
	/** Schema version */
	version: 1;
	/** Timestamp of last modification */
	modifiedAt: string;
	/** Map of capability ID -> array of allowed finding types */
	allows: Record<string, FindingType[]>;
}

/**
 * An individual security allow entry
 */
export interface SecurityAllow {
	capabilityId: string;
	findingType: FindingType;
}

const DEFAULT_STATE: SecurityAllowsState = {
	version: 1,
	modifiedAt: new Date().toISOString(),
	allows: {},
};

/**
 * Read the security allows from local state.
 * Returns empty state if no file exists.
 */
export async function readSecurityAllows(): Promise<SecurityAllowsState> {
	if (!existsSync(SECURITY_PATH)) {
		return { ...DEFAULT_STATE };
	}

	try {
		const content = await readFile(SECURITY_PATH, "utf-8");
		const state = JSON.parse(content) as SecurityAllowsState;
		return state;
	} catch {
		return { ...DEFAULT_STATE };
	}
}

/**
 * Write security allows to local state.
 */
export async function writeSecurityAllows(state: SecurityAllowsState): Promise<void> {
	mkdirSync(OMNI_DIR, { recursive: true });
	state.modifiedAt = new Date().toISOString();
	await writeFile(SECURITY_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

/**
 * Add an allow for a specific capability and finding type.
 */
export async function addSecurityAllow(
	capabilityId: string,
	findingType: FindingType,
): Promise<boolean> {
	const state = await readSecurityAllows();

	if (!state.allows[capabilityId]) {
		state.allows[capabilityId] = [];
	}

	// Check if already allowed
	if (state.allows[capabilityId].includes(findingType)) {
		return false; // Already exists
	}

	state.allows[capabilityId].push(findingType);
	await writeSecurityAllows(state);
	return true;
}

/**
 * Remove an allow for a specific capability and finding type.
 */
export async function removeSecurityAllow(
	capabilityId: string,
	findingType: FindingType,
): Promise<boolean> {
	const state = await readSecurityAllows();

	if (!state.allows[capabilityId]) {
		return false; // Doesn't exist
	}

	const index = state.allows[capabilityId].indexOf(findingType);
	if (index === -1) {
		return false; // Doesn't exist
	}

	state.allows[capabilityId].splice(index, 1);

	// Clean up empty arrays
	if (state.allows[capabilityId].length === 0) {
		delete state.allows[capabilityId];
	}

	await writeSecurityAllows(state);
	return true;
}

/**
 * Check if a finding type is allowed for a capability.
 */
export async function isSecurityAllowed(
	capabilityId: string,
	findingType: FindingType,
): Promise<boolean> {
	const state = await readSecurityAllows();
	const allows = state.allows[capabilityId];
	if (!allows) return false;
	return allows.includes(findingType);
}

/**
 * Get all allows for a capability.
 */
export async function getCapabilityAllows(capabilityId: string): Promise<FindingType[]> {
	const state = await readSecurityAllows();
	return state.allows[capabilityId] ?? [];
}

/**
 * Get all security allows as a flat list.
 */
export async function getAllSecurityAllows(): Promise<SecurityAllow[]> {
	const state = await readSecurityAllows();
	const result: SecurityAllow[] = [];

	for (const [capabilityId, findingTypes] of Object.entries(state.allows)) {
		for (const findingType of findingTypes) {
			result.push({ capabilityId, findingType });
		}
	}

	return result;
}

/**
 * Clear all allows for a capability.
 */
export async function clearCapabilityAllows(capabilityId: string): Promise<boolean> {
	const state = await readSecurityAllows();

	if (!state.allows[capabilityId]) {
		return false;
	}

	delete state.allows[capabilityId];
	await writeSecurityAllows(state);
	return true;
}

/**
 * Clear all security allows.
 */
export async function clearAllSecurityAllows(): Promise<void> {
	const state = { ...DEFAULT_STATE };
	await writeSecurityAllows(state);
}
