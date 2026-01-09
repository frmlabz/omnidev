/**
 * Ralph State Management
 *
 * Functions for persisting and retrieving PRDs, stories, and progress.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PRD, Story } from "./types.js";

const RALPH_DIR = ".omni/ralph";
const PRDS_DIR = join(RALPH_DIR, "prds");
const COMPLETED_PRDS_DIR = join(RALPH_DIR, "completed-prds");
const ACTIVE_PRD_FILE = join(RALPH_DIR, "active-prd");

/**
 * Get the path to a PRD directory
 */
function getPRDPath(name: string, completed = false): string {
	const baseDir = completed ? COMPLETED_PRDS_DIR : PRDS_DIR;
	return join(process.cwd(), baseDir, name);
}

/**
 * Get the path to a PRD file
 */
function getPRDFilePath(name: string, completed = false): string {
	return join(getPRDPath(name, completed), "prd.json");
}

/**
 * Get the path to a progress file
 */
function getProgressFilePath(name: string, completed = false): string {
	return join(getPRDPath(name, completed), "progress.txt");
}

/**
 * Get the path to the specs directory
 */
function getSpecsPath(name: string, completed = false): string {
	return join(getPRDPath(name, completed), "specs");
}

/**
 * List all PRDs (active and optionally completed)
 */
export async function listPRDs(includeCompleted = false): Promise<string[]> {
	const prdsPath = join(process.cwd(), PRDS_DIR);
	const prdNames: string[] = [];

	// List active PRDs
	if (existsSync(prdsPath)) {
		const entries = readdirSync(prdsPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				prdNames.push(entry.name);
			}
		}
	}

	// List completed PRDs if requested
	if (includeCompleted) {
		const completedPath = join(process.cwd(), COMPLETED_PRDS_DIR);
		if (existsSync(completedPath)) {
			const entries = readdirSync(completedPath, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory()) {
					prdNames.push(`${entry.name} (completed)`);
				}
			}
		}
	}

	return prdNames;
}

/**
 * Find an archived PRD by base name (searches for YYYY-MM-DD-{name} pattern)
 */
function findArchivedPRD(baseName: string): string | null {
	const completedDir = join(process.cwd(), COMPLETED_PRDS_DIR);

	if (!existsSync(completedDir)) {
		return null;
	}

	const entries = readdirSync(completedDir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory() && entry.name.endsWith(`-${baseName}`)) {
			const archivedPath = join(completedDir, entry.name, "prd.json");
			if (existsSync(archivedPath)) {
				return archivedPath;
			}
		}
	}

	return null;
}

/**
 * Get a PRD by name
 */
export async function getPRD(name: string): Promise<PRD> {
	// Try active PRDs first
	let prdPath = getPRDFilePath(name, false);

	// If not found, try completed PRDs
	if (!existsSync(prdPath)) {
		// Try with exact name first
		prdPath = getPRDFilePath(name, true);

		// If still not found, search for archived PRD with timestamp prefix
		if (!existsSync(prdPath)) {
			const archivedPath = findArchivedPRD(name);
			if (archivedPath) {
				prdPath = archivedPath;
			} else {
				throw new Error(`PRD not found: ${name}`);
			}
		}
	}

	const content = await Bun.file(prdPath).text();
	const prd = JSON.parse(content) as PRD;

	// Validate PRD structure (check for undefined/null, not empty strings)
	if (
		prd.name === undefined ||
		prd.branchName === undefined ||
		prd.description === undefined ||
		prd.userStories === undefined
	) {
		throw new Error(`Invalid PRD structure: ${name}`);
	}

	return prd;
}

/**
 * Create a new PRD
 */
export async function createPRD(name: string, options: Partial<PRD> = {}): Promise<PRD> {
	const prdPath = getPRDPath(name, false);

	// Check if PRD already exists
	if (existsSync(prdPath)) {
		throw new Error(`PRD already exists: ${name}`);
	}

	// Create PRD directory structure
	mkdirSync(prdPath, { recursive: true });
	mkdirSync(getSpecsPath(name, false), { recursive: true });

	// Create PRD object
	const prd: PRD = {
		name,
		branchName: options.branchName || `ralph/${name}`,
		description: options.description || "",
		createdAt: options.createdAt || new Date().toISOString(),
		userStories: options.userStories || [],
	};

	// Write PRD to file
	const prdFilePath = getPRDFilePath(name, false);
	await Bun.write(prdFilePath, JSON.stringify(prd, null, 2));

	// Create empty progress file
	const progressPath = getProgressFilePath(name, false);
	await Bun.write(progressPath, "## Codebase Patterns\n\n---\n\n## Progress Log\n\n");

	return prd;
}

/**
 * Update an existing PRD
 */
export async function updatePRD(name: string, updates: Partial<PRD>): Promise<PRD> {
	// Get existing PRD
	const existingPRD = await getPRD(name);

	// Merge updates
	const updatedPRD: PRD = {
		...existingPRD,
		...updates,
		// Ensure name doesn't change
		name: existingPRD.name,
	};

	// Write updated PRD
	const prdPath = getPRDFilePath(name, false);
	await Bun.write(prdPath, JSON.stringify(updatedPRD, null, 2));

	return updatedPRD;
}

/**
 * Archive a PRD (move to completed-prds/)
 */
export async function archivePRD(name: string): Promise<void> {
	const activePath = getPRDPath(name, false);

	if (!existsSync(activePath)) {
		throw new Error(`PRD not found: ${name}`);
	}

	// Create completed PRDs directory if it doesn't exist
	const completedDir = join(process.cwd(), COMPLETED_PRDS_DIR);
	mkdirSync(completedDir, { recursive: true });

	// Generate archive name with timestamp
	const timestamp = new Date().toISOString().split("T")[0];
	const archiveName = `${timestamp}-${name}`;
	const completedPath = getPRDPath(archiveName, true);

	// Check if archive already exists
	if (existsSync(completedPath)) {
		throw new Error(`Archive already exists: ${archiveName}`);
	}

	// Move directory using Bun's file system API
	const { renameSync } = await import("node:fs");
	renameSync(activePath, completedPath);
}

/**
 * Delete a PRD (with confirmation)
 */
export async function deletePRD(name: string): Promise<void> {
	const activePath = getPRDPath(name, false);

	let pathToDelete: string | null = null;

	if (existsSync(activePath)) {
		pathToDelete = activePath;
	} else {
		// Try exact completed path
		const completedPath = getPRDPath(name, true);
		if (existsSync(completedPath)) {
			pathToDelete = completedPath;
		} else {
			// Search for archived PRD with timestamp prefix
			const archivedPath = findArchivedPRD(name);
			if (archivedPath) {
				// Get directory path from file path
				pathToDelete = join(archivedPath, "..");
			}
		}
	}

	if (!pathToDelete) {
		throw new Error(`PRD not found: ${name}`);
	}

	// Delete directory recursively
	const { rmSync } = await import("node:fs");
	rmSync(pathToDelete, { recursive: true, force: true });
}

/**
 * Get the next incomplete story from a PRD
 */
export async function getNextStory(prdName: string): Promise<Story | null> {
	const prd = await getPRD(prdName);

	// Find stories that haven't passed, sorted by priority
	const incompleteStories = prd.userStories
		.filter((story) => !story.passes)
		.sort((a, b) => a.priority - b.priority);

	const firstStory = incompleteStories[0];
	return firstStory !== undefined ? firstStory : null;
}

/**
 * Mark a story as passed
 */
export async function markStoryPassed(prdName: string, storyId: string): Promise<void> {
	const prd = await getPRD(prdName);

	// Find the story
	const story = prd.userStories.find((s) => s.id === storyId);
	if (!story) {
		throw new Error(`Story not found: ${storyId}`);
	}

	// Mark as passed
	story.passes = true;

	// Update PRD
	await updatePRD(prdName, { userStories: prd.userStories });
}

/**
 * Mark a story as failed
 */
export async function markStoryFailed(prdName: string, storyId: string): Promise<void> {
	const prd = await getPRD(prdName);

	// Find the story
	const story = prd.userStories.find((s) => s.id === storyId);
	if (!story) {
		throw new Error(`Story not found: ${storyId}`);
	}

	// Mark as failed
	story.passes = false;

	// Update PRD
	await updatePRD(prdName, { userStories: prd.userStories });
}

/**
 * Append content to the progress log
 */
export async function appendProgress(prdName: string, content: string): Promise<void> {
	const progressPath = getProgressFilePath(prdName, false);

	// Read existing content
	let existingContent = "";
	if (existsSync(progressPath)) {
		existingContent = await Bun.file(progressPath).text();
	}

	// Append new content
	const updatedContent = `${existingContent}\n${content}\n`;
	await Bun.write(progressPath, updatedContent);
}

/**
 * Get the progress log content
 */
export async function getProgress(prdName: string): Promise<string> {
	const progressPath = getProgressFilePath(prdName, false);

	if (!existsSync(progressPath)) {
		return "";
	}

	return await Bun.file(progressPath).text();
}

/**
 * Extract codebase patterns from the progress log
 */
export async function getPatterns(prdName: string): Promise<string[]> {
	const progressContent = await getProgress(prdName);
	const lines = progressContent.split("\n");
	const patterns: string[] = [];
	let inPatternsSection = false;

	for (const line of lines) {
		if (line.startsWith("## Codebase Patterns")) {
			inPatternsSection = true;
			continue;
		}
		if (line.startsWith("## ") && inPatternsSection) {
			break;
		}
		if (inPatternsSection && line.startsWith("- ")) {
			patterns.push(line.slice(2));
		}
	}

	return patterns;
}

/**
 * Get the currently active PRD name
 */
export async function getActivePRD(): Promise<string | null> {
	const activePRDPath = join(process.cwd(), ACTIVE_PRD_FILE);

	if (!existsSync(activePRDPath)) {
		return null;
	}

	const content = await Bun.file(activePRDPath).text();
	return content.trim();
}

/**
 * Set the currently active PRD
 */
export async function setActivePRD(name: string): Promise<void> {
	// Verify PRD exists
	const prdPath = getPRDPath(name, false);
	if (!existsSync(prdPath)) {
		throw new Error(`PRD not found: ${name}`);
	}

	// Create Ralph directory if it doesn't exist
	const ralphDir = join(process.cwd(), RALPH_DIR);
	mkdirSync(ralphDir, { recursive: true });

	// Write active PRD name
	const activePRDPath = join(process.cwd(), ACTIVE_PRD_FILE);
	await Bun.write(activePRDPath, name);
}
