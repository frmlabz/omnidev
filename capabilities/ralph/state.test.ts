/**
 * Tests for Ralph state management
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	appendProgress,
	archivePRD,
	createPRD,
	deletePRD,
	getActivePRD,
	getNextStory,
	getPatterns,
	getPRD,
	getProgress,
	listPRDs,
	markStoryFailed,
	markStoryPassed,
	setActivePRD,
	updatePRD,
} from "./state.js";

describe("Ralph State Management", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		// Create unique test directory
		testDir = join(
			process.cwd(),
			".test-ralph",
			`test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		);
		mkdirSync(testDir, { recursive: true });

		// Change to test directory
		originalCwd = process.cwd();
		process.chdir(testDir);

		// Create Ralph directory structure
		mkdirSync(".omni/ralph/prds", { recursive: true });
		mkdirSync(".omni/ralph/completed-prds", { recursive: true });
	});

	afterEach(() => {
		// Change back to original directory
		process.chdir(originalCwd);

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("listPRDs", () => {
		test("returns empty array when no PRDs exist", async () => {
			const prds = await listPRDs();
			expect(prds).toEqual([]);
		});

		test("lists active PRDs", async () => {
			await createPRD("test-prd-1");
			await createPRD("test-prd-2");

			const prds = await listPRDs();
			expect(prds).toContain("test-prd-1");
			expect(prds).toContain("test-prd-2");
			expect(prds.length).toBe(2);
		});

		test("includes completed PRDs when requested", async () => {
			await createPRD("active-prd");

			// Manually create completed PRD
			const completedPath = ".omni/ralph/completed-prds/completed-prd";
			mkdirSync(completedPath, { recursive: true });
			writeFileSync(
				join(completedPath, "prd.json"),
				JSON.stringify({
					name: "completed-prd",
					branchName: "main",
					description: "Completed",
					createdAt: new Date().toISOString(),
					userStories: [],
				}),
			);

			const prds = await listPRDs(true);
			expect(prds).toContain("active-prd");
			expect(prds).toContain("completed-prd (completed)");
		});
	});

	describe("getPRD", () => {
		test("retrieves an existing PRD", async () => {
			await createPRD("test-prd", {
				description: "Test PRD",
				branchName: "feature/test",
			});

			const retrieved = await getPRD("test-prd");
			expect(retrieved.name).toBe("test-prd");
			expect(retrieved.description).toBe("Test PRD");
			expect(retrieved.branchName).toBe("feature/test");
		});

		test("throws error for non-existent PRD", async () => {
			await expect(getPRD("non-existent")).rejects.toThrow("PRD not found: non-existent");
		});

		test("retrieves completed PRD when active not found", async () => {
			// Create and archive a PRD
			await createPRD("test-prd", { description: "Test" });
			await archivePRD("test-prd");

			// Should find it in completed PRDs
			const prd = await getPRD("test-prd");
			expect(prd.name).toBe("test-prd");
		});

		test("throws error for invalid PRD structure", async () => {
			// Manually create invalid PRD
			const prdPath = ".omni/ralph/prds/invalid-prd";
			mkdirSync(prdPath, { recursive: true });
			writeFileSync(join(prdPath, "prd.json"), JSON.stringify({ foo: "bar" }));

			await expect(getPRD("invalid-prd")).rejects.toThrow("Invalid PRD structure");
		});
	});

	describe("createPRD", () => {
		test("creates PRD with default values", async () => {
			const prd = await createPRD("test-prd");

			expect(prd.name).toBe("test-prd");
			expect(prd.branchName).toBe("ralph/test-prd");
			expect(prd.description).toBe("");
			expect(prd.userStories).toEqual([]);
			expect(prd.createdAt).toBeTruthy();

			// Verify file exists
			const prdPath = ".omni/ralph/prds/test-prd/prd.json";
			expect(existsSync(prdPath)).toBe(true);
		});

		test("creates PRD with custom options", async () => {
			const prd = await createPRD("custom-prd", {
				branchName: "feature/custom",
				description: "Custom PRD",
				userStories: [
					{
						id: "US-001",
						title: "Test Story",
						specFile: "spec-001.md",
						scope: "Full implementation",
						acceptanceCriteria: ["Criterion 1"],
						priority: 1,
						passes: false,
						notes: "",
					},
				],
			});

			expect(prd.branchName).toBe("feature/custom");
			expect(prd.description).toBe("Custom PRD");
			expect(prd.userStories.length).toBe(1);
		});

		test("creates directory structure", async () => {
			await createPRD("test-prd");

			const prdDir = ".omni/ralph/prds/test-prd";
			const specsDir = join(prdDir, "specs");

			expect(existsSync(prdDir)).toBe(true);
			expect(existsSync(specsDir)).toBe(true);
			expect(existsSync(join(prdDir, "prd.json"))).toBe(true);
			expect(existsSync(join(prdDir, "progress.txt"))).toBe(true);
		});

		test("throws error if PRD already exists", async () => {
			await createPRD("test-prd");

			await expect(createPRD("test-prd")).rejects.toThrow("PRD already exists");
		});
	});

	describe("updatePRD", () => {
		test("updates PRD fields", async () => {
			await createPRD("test-prd", { description: "Original" });

			const updated = await updatePRD("test-prd", {
				description: "Updated",
				branchName: "feature/updated",
			});

			expect(updated.description).toBe("Updated");
			expect(updated.branchName).toBe("feature/updated");

			// Verify persisted
			const retrieved = await getPRD("test-prd");
			expect(retrieved.description).toBe("Updated");
		});

		test("preserves name even if update tries to change it", async () => {
			await createPRD("test-prd");

			const updated = await updatePRD("test-prd", {
				name: "different-name" as never,
			});

			expect(updated.name).toBe("test-prd");
		});

		test("throws error for non-existent PRD", async () => {
			await expect(updatePRD("non-existent", { description: "Test" })).rejects.toThrow(
				"PRD not found",
			);
		});
	});

	describe("archivePRD", () => {
		test("moves PRD to completed directory", async () => {
			await createPRD("test-prd");

			await archivePRD("test-prd");

			// Check active directory is empty
			const activePath = ".omni/ralph/prds/test-prd";
			expect(existsSync(activePath)).toBe(false);

			// Check completed directory has archived PRD
			const timestamp = new Date().toISOString().split("T")[0];
			const completedPath = `.omni/ralph/completed-prds/${timestamp}-test-prd`;
			expect(existsSync(completedPath)).toBe(true);
		});

		test("throws error for non-existent PRD", async () => {
			await expect(archivePRD("non-existent")).rejects.toThrow("PRD not found");
		});

		test("throws error if archive already exists", async () => {
			await createPRD("test-prd");
			await archivePRD("test-prd");

			// Create another PRD with same name
			await createPRD("test-prd");

			// Try to archive again on same day
			await expect(archivePRD("test-prd")).rejects.toThrow("Archive already exists");
		});
	});

	describe("deletePRD", () => {
		test("deletes active PRD", async () => {
			await createPRD("test-prd");

			await deletePRD("test-prd");

			const prdPath = ".omni/ralph/prds/test-prd";
			expect(existsSync(prdPath)).toBe(false);
		});

		test("deletes completed PRD", async () => {
			await createPRD("test-prd");
			await archivePRD("test-prd");

			await deletePRD("test-prd");

			// Should not find it in completed directory
			const prds = await listPRDs(true);
			expect(prds.some((name) => name.includes("test-prd"))).toBe(false);
		});

		test("throws error for non-existent PRD", async () => {
			await expect(deletePRD("non-existent")).rejects.toThrow("PRD not found");
		});
	});

	describe("getNextStory", () => {
		test("returns null when no incomplete stories", async () => {
			await createPRD("test-prd", {
				userStories: [
					{
						id: "US-001",
						title: "Story 1",
						specFile: "spec.md",
						scope: "Full",
						acceptanceCriteria: [],
						priority: 1,
						passes: true,
						notes: "",
					},
				],
			});

			const story = await getNextStory("test-prd");
			expect(story).toBe(null);
		});

		test("returns highest priority incomplete story", async () => {
			await createPRD("test-prd", {
				userStories: [
					{
						id: "US-001",
						title: "Story 1",
						specFile: "spec.md",
						scope: "Full",
						acceptanceCriteria: [],
						priority: 2,
						passes: false,
						notes: "",
					},
					{
						id: "US-002",
						title: "Story 2",
						specFile: "spec.md",
						scope: "Full",
						acceptanceCriteria: [],
						priority: 1,
						passes: false,
						notes: "",
					},
				],
			});

			const story = await getNextStory("test-prd");
			expect(story?.id).toBe("US-002"); // Lower priority number = higher priority
		});

		test("returns null for empty PRD", async () => {
			await createPRD("test-prd");

			const story = await getNextStory("test-prd");
			expect(story).toBe(null);
		});
	});

	describe("markStoryPassed", () => {
		test("marks story as passed", async () => {
			await createPRD("test-prd", {
				userStories: [
					{
						id: "US-001",
						title: "Story 1",
						specFile: "spec.md",
						scope: "Full",
						acceptanceCriteria: [],
						priority: 1,
						passes: false,
						notes: "",
					},
				],
			});

			await markStoryPassed("test-prd", "US-001");

			const prd = await getPRD("test-prd");
			const story = prd.userStories.find((s) => s.id === "US-001");
			expect(story?.passes).toBe(true);
		});

		test("throws error for non-existent story", async () => {
			await createPRD("test-prd");

			await expect(markStoryPassed("test-prd", "US-999")).rejects.toThrow("Story not found");
		});
	});

	describe("markStoryFailed", () => {
		test("marks story as failed", async () => {
			await createPRD("test-prd", {
				userStories: [
					{
						id: "US-001",
						title: "Story 1",
						specFile: "spec.md",
						scope: "Full",
						acceptanceCriteria: [],
						priority: 1,
						passes: true,
						notes: "",
					},
				],
			});

			await markStoryFailed("test-prd", "US-001");

			const prd = await getPRD("test-prd");
			const story = prd.userStories.find((s) => s.id === "US-001");
			expect(story?.passes).toBe(false);
		});

		test("throws error for non-existent story", async () => {
			await createPRD("test-prd");

			await expect(markStoryFailed("test-prd", "US-999")).rejects.toThrow("Story not found");
		});
	});

	describe("appendProgress", () => {
		test("appends content to progress log", async () => {
			await createPRD("test-prd");

			await appendProgress("test-prd", "## Entry 1\n- Item 1");
			await appendProgress("test-prd", "## Entry 2\n- Item 2");

			const progress = await getProgress("test-prd");
			expect(progress).toContain("## Entry 1");
			expect(progress).toContain("## Entry 2");
		});

		test("creates progress file if it does not exist", async () => {
			await createPRD("test-prd");

			// Delete progress file
			const progressPath = ".omni/ralph/prds/test-prd/progress.txt";
			rmSync(progressPath, { force: true });

			await appendProgress("test-prd", "## New Entry");

			const progress = await getProgress("test-prd");
			expect(progress).toContain("## New Entry");
		});
	});

	describe("getProgress", () => {
		test("returns progress log content", async () => {
			await createPRD("test-prd");
			await appendProgress("test-prd", "## Test Entry");

			const progress = await getProgress("test-prd");
			expect(progress).toContain("## Test Entry");
		});

		test("returns empty string for non-existent progress file", async () => {
			await createPRD("test-prd");

			// Delete progress file
			const progressPath = ".omni/ralph/prds/test-prd/progress.txt";
			rmSync(progressPath, { force: true });

			const progress = await getProgress("test-prd");
			expect(progress).toBe("");
		});
	});

	describe("getPatterns", () => {
		test("extracts patterns from progress log", async () => {
			await createPRD("test-prd");

			const progressContent = `## Codebase Patterns
- Use Bun for file operations
- Always use strict TypeScript
- Test coverage should be 70%+

## Progress Log

## Entry 1
- Some progress
`;

			// Write directly to progress file
			const progressPath = ".omni/ralph/prds/test-prd/progress.txt";
			writeFileSync(progressPath, progressContent);

			const patterns = await getPatterns("test-prd");
			expect(patterns).toContain("Use Bun for file operations");
			expect(patterns).toContain("Always use strict TypeScript");
			expect(patterns).toContain("Test coverage should be 70%+");
			expect(patterns.length).toBe(3);
		});

		test("returns empty array when no patterns section", async () => {
			await createPRD("test-prd");
			await appendProgress("test-prd", "## Entry 1\n- Progress");

			const patterns = await getPatterns("test-prd");
			expect(patterns).toEqual([]);
		});

		test("returns empty array when patterns section is empty", async () => {
			await createPRD("test-prd");

			const progressContent = `## Codebase Patterns

## Progress Log
`;
			const progressPath = ".omni/ralph/prds/test-prd/progress.txt";
			writeFileSync(progressPath, progressContent);

			const patterns = await getPatterns("test-prd");
			expect(patterns).toEqual([]);
		});
	});

	describe("getActivePRD", () => {
		test("returns null when no active PRD", async () => {
			const active = await getActivePRD();
			expect(active).toBe(null);
		});

		test("returns active PRD name", async () => {
			await createPRD("test-prd");
			await setActivePRD("test-prd");

			const active = await getActivePRD();
			expect(active).toBe("test-prd");
		});
	});

	describe("setActivePRD", () => {
		test("sets active PRD", async () => {
			await createPRD("test-prd");

			await setActivePRD("test-prd");

			const active = await getActivePRD();
			expect(active).toBe("test-prd");
		});

		test("throws error for non-existent PRD", async () => {
			await expect(setActivePRD("non-existent")).rejects.toThrow("PRD not found");
		});

		test("creates Ralph directory if it does not exist", async () => {
			// Delete Ralph directory
			rmSync(".omni/ralph", { recursive: true, force: true });

			await createPRD("test-prd");
			await setActivePRD("test-prd");

			const ralphDir = ".omni/ralph";
			expect(existsSync(ralphDir)).toBe(true);
		});
	});
});
