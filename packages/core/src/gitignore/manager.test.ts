import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import {
	addCapabilityPatterns,
	buildGitignoreContent,
	parseCapabilitySections,
	readGitignore,
	rebuildGitignore,
	removeCapabilityPatterns,
	writeGitignore,
} from "./manager.js";

const TEST_DIR = ".omni-test-gitignore";

describe("Gitignore Manager", () => {
	beforeEach(() => {
		// Create test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });

		// Change working directory
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		// Restore working directory
		process.chdir("..");

		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("readGitignore", () => {
		test("returns base content when file doesn't exist", async () => {
			const content = await readGitignore();
			expect(content).toContain("# OmniDev working files");
			expect(content).toContain(".env");
			expect(content).toContain("generated/");
		});

		test("returns existing content when file exists", async () => {
			await writeGitignore("# Custom content\n*.tmp\n");
			const content = await readGitignore();
			expect(content).toBe("# Custom content\n*.tmp\n");
		});
	});

	describe("parseCapabilitySections", () => {
		test("parses empty content", () => {
			const sections = parseCapabilitySections("");
			expect(sections.size).toBe(0);
		});

		test("parses single capability section", () => {
			const content = `# Base content

# tasks capability
work/
*.tmp

# End`;

			const sections = parseCapabilitySections(content);
			expect(sections.size).toBe(1);
			expect(sections.get("tasks")).toEqual(["work/", "*.tmp"]);
		});

		test("parses multiple capability sections", () => {
			const content = `# Base content

# tasks capability
work/
*.tmp

# ralph capability
progress.txt
*.log

# End`;

			const sections = parseCapabilitySections(content);
			expect(sections.size).toBe(2);
			expect(sections.get("tasks")).toEqual(["work/", "*.tmp"]);
			expect(sections.get("ralph")).toEqual(["progress.txt", "*.log"]);
		});

		test("handles capability with no patterns", () => {
			const content = `# tasks capability

# ralph capability
progress.txt`;

			const sections = parseCapabilitySections(content);
			expect(sections.size).toBe(1);
			expect(sections.get("ralph")).toEqual(["progress.txt"]);
		});
	});

	describe("buildGitignoreContent", () => {
		test("builds base content with no capabilities", () => {
			const content = buildGitignoreContent(new Map());
			expect(content).toContain("# OmniDev working files");
			expect(content).toContain(".env");
			expect(content).not.toContain("# tasks capability");
		});

		test("builds content with single capability", () => {
			const sections = new Map([["tasks", ["work/", "*.tmp"]]]);
			const content = buildGitignoreContent(sections);
			expect(content).toContain("# tasks capability");
			expect(content).toContain("work/");
			expect(content).toContain("*.tmp");
		});

		test("builds content with multiple capabilities", () => {
			const sections = new Map([
				["tasks", ["work/", "*.tmp"]],
				["ralph", ["progress.txt"]],
			]);
			const content = buildGitignoreContent(sections);
			expect(content).toContain("# tasks capability");
			expect(content).toContain("work/");
			expect(content).toContain("# ralph capability");
			expect(content).toContain("progress.txt");
		});

		test("skips capabilities with empty patterns", () => {
			const sections = new Map([
				["tasks", []],
				["ralph", ["progress.txt"]],
			]);
			const content = buildGitignoreContent(sections);
			expect(content).not.toContain("# tasks capability");
			expect(content).toContain("# ralph capability");
		});
	});

	describe("addCapabilityPatterns", () => {
		test("adds patterns to empty file", async () => {
			await addCapabilityPatterns("tasks", ["work/", "*.tmp"]);
			const content = await readGitignore();
			expect(content).toContain("# tasks capability");
			expect(content).toContain("work/");
			expect(content).toContain("*.tmp");
		});

		test("adds patterns to existing file", async () => {
			await addCapabilityPatterns("tasks", ["work/"]);
			await addCapabilityPatterns("ralph", ["progress.txt"]);

			const content = await readGitignore();
			expect(content).toContain("# tasks capability");
			expect(content).toContain("work/");
			expect(content).toContain("# ralph capability");
			expect(content).toContain("progress.txt");
		});

		test("updates existing capability patterns", async () => {
			await addCapabilityPatterns("tasks", ["work/"]);
			await addCapabilityPatterns("tasks", ["work/", "*.tmp"]);

			const content = await readGitignore();
			const sections = parseCapabilitySections(content);
			expect(sections.get("tasks")).toEqual(["work/", "*.tmp"]);
		});
	});

	describe("removeCapabilityPatterns", () => {
		test("removes capability patterns", async () => {
			await addCapabilityPatterns("tasks", ["work/"]);
			await addCapabilityPatterns("ralph", ["progress.txt"]);
			await removeCapabilityPatterns("tasks");

			const content = await readGitignore();
			expect(content).not.toContain("# tasks capability");
			expect(content).toContain("# ralph capability");
		});

		test("handles removing non-existent capability", async () => {
			await addCapabilityPatterns("tasks", ["work/"]);
			await removeCapabilityPatterns("nonexistent");

			const content = await readGitignore();
			expect(content).toContain("# tasks capability");
		});
	});

	describe("rebuildGitignore", () => {
		test("rebuilds gitignore from scratch", async () => {
			// Add some capabilities manually
			await addCapabilityPatterns("tasks", ["work/"]);
			await addCapabilityPatterns("ralph", ["progress.txt"]);

			// Rebuild with only one capability
			const newSections = new Map([["tasks", ["new-work/", "*.new"]]]);
			await rebuildGitignore(newSections);

			const content = await readGitignore();
			expect(content).toContain("# tasks capability");
			expect(content).toContain("new-work/");
			expect(content).toContain("*.new");
			expect(content).not.toContain("# ralph capability");
			expect(content).not.toContain("progress.txt");
		});

		test("rebuilds empty gitignore", async () => {
			await addCapabilityPatterns("tasks", ["work/"]);
			await rebuildGitignore(new Map());

			const content = await readGitignore();
			expect(content).not.toContain("# tasks capability");
			expect(content).toContain("# OmniDev working files");
		});
	});
});
