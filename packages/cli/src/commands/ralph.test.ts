/**
 * Tests for Ralph CLI commands
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	runLog,
	runPatterns,
	runPrdArchive,
	runPrdCreate,
	runPrdList,
	runPrdSelect,
	runPrdView,
	runRalphInit,
	runSpecCreate,
	runSpecList,
	runSpecView,
	runStoryAdd,
	runStoryList,
	runStoryPass,
	runStoryReset,
} from "./ralph";

const TEST_DIR = join(process.cwd(), ".test-ralph-cli");
const RALPH_DIR = join(TEST_DIR, ".omni/ralph");
const CONFIG_PATH = join(RALPH_DIR, "config.toml");
const PRDS_DIR = join(RALPH_DIR, "prds");
const COMPLETED_PRDS_DIR = join(RALPH_DIR, "completed-prds");

beforeEach(() => {
	// Create test directory
	mkdirSync(TEST_DIR, { recursive: true });
	process.chdir(TEST_DIR);
});

afterEach(() => {
	process.chdir(join(TEST_DIR, ".."));
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true, force: true });
	}
});

describe("runRalphInit", () => {
	test("creates directory structure", async () => {
		await runRalphInit();

		expect(existsSync(RALPH_DIR)).toBe(true);
		expect(existsSync(PRDS_DIR)).toBe(true);
		expect(existsSync(COMPLETED_PRDS_DIR)).toBe(true);
	});

	test("creates default config", async () => {
		await runRalphInit();

		expect(existsSync(CONFIG_PATH)).toBe(true);

		const content = await Bun.file(CONFIG_PATH).text();
		expect(content).toContain("[ralph]");
		expect(content).toContain("default_agent");
		expect(content).toContain("[agents.claude]");
	});

	test("doesn't overwrite existing config", async () => {
		// First init
		await runRalphInit();

		// Modify config
		const customConfig = "[ralph]\ncustom = true\n";
		await Bun.write(CONFIG_PATH, customConfig);

		// Second init
		await runRalphInit();

		// Config should be unchanged
		const content = await Bun.file(CONFIG_PATH).text();
		expect(content).toBe(customConfig);
	});

	test("is idempotent", async () => {
		await runRalphInit();
		await runRalphInit();

		expect(existsSync(RALPH_DIR)).toBe(true);
		expect(existsSync(CONFIG_PATH)).toBe(true);
	});
});

// Note: runRalphStatus and runRalphStart tests are skipped because they require
// the ralph capability to be available, which isn't set up in the test environment.
// These commands are tested through integration tests instead.

/**
 * Helper function to set up Ralph capability mock in test environment
 */
async function setupRalphCapabilityMock() {
	const capDir = join(TEST_DIR, "capabilities/ralph");
	mkdirSync(capDir, { recursive: true });

	// Create a mock Ralph capability module
	const mockModule = `
export async function listPRDs() {
	const { readdirSync, existsSync } = await import('node:fs');
	const { join } = await import('node:path');
	const prdsDir = join(process.cwd(), '.omni/ralph/prds');
	if (!existsSync(prdsDir)) return [];
	return readdirSync(prdsDir, { withFileTypes: true })
		.filter(d => d.isDirectory())
		.map(d => d.name);
}

export async function getActivePRD() {
	const { existsSync } = await import('node:fs');
	const { join } = await import('node:path');
	const activePath = join(process.cwd(), '.omni/ralph/active-prd');
	if (!existsSync(activePath)) return null;
	return (await Bun.file(activePath).text()).trim();
}

export async function setActivePRD(name) {
	const { join } = await import('node:path');
	const { mkdirSync } = await import('node:fs');
	const ralphDir = join(process.cwd(), '.omni/ralph');
	mkdirSync(ralphDir, { recursive: true });
	const activePath = join(ralphDir, 'active-prd');
	await Bun.write(activePath, name);
}

export async function createPRD(name, options) {
	const { join } = await import('node:path');
	const { mkdirSync } = await import('node:fs');
	const prdDir = join(process.cwd(), '.omni/ralph/prds', name);
	mkdirSync(prdDir, { recursive: true });

	const prd = {
		name,
		branchName: options.branchName || 'main',
		description: options.description || '',
		createdAt: new Date().toISOString(),
		userStories: options.userStories || []
	};

	await Bun.write(join(prdDir, 'prd.json'), JSON.stringify(prd, null, 2));

	const progressPath = join(prdDir, 'progress.txt');
	await Bun.write(progressPath, '## Codebase Patterns\\n\\n---\\n\\n## Progress Log\\n\\n');

	return prd;
}

export async function getPRD(name) {
	const { join } = await import('node:path');
	const prdPath = join(process.cwd(), '.omni/ralph/prds', name, 'prd.json');
	return JSON.parse(await Bun.file(prdPath).text());
}

export async function updatePRD(name, updates) {
	const prd = await getPRD(name);
	Object.assign(prd, updates);
	const { join } = await import('node:path');
	const prdPath = join(process.cwd(), '.omni/ralph/prds', name, 'prd.json');
	await Bun.write(prdPath, JSON.stringify(prd, null, 2));
	return prd;
}

export async function archivePRD(name) {
	const { join } = await import('node:path');
	const { mkdirSync, renameSync } = await import('node:fs');
	const prdsDir = join(process.cwd(), '.omni/ralph/prds');
	const completedDir = join(process.cwd(), '.omni/ralph/completed-prds');
	mkdirSync(completedDir, { recursive: true });

	const srcPath = join(prdsDir, name);
	const timestamp = new Date().toISOString().split('T')[0];
	const destPath = join(completedDir, \`\${timestamp}-\${name}\`);
	renameSync(srcPath, destPath);
}

export async function markStoryPassed(prdName, storyId) {
	const prd = await getPRD(prdName);
	const story = prd.userStories.find(s => s.id === storyId);
	if (!story) throw new Error(\`Story \${storyId} not found\`);
	story.passes = true;
	await updatePRD(prdName, { userStories: prd.userStories });
}

export async function markStoryFailed(prdName, storyId) {
	const prd = await getPRD(prdName);
	const story = prd.userStories.find(s => s.id === storyId);
	if (!story) throw new Error(\`Story \${storyId} not found\`);
	story.passes = false;
	await updatePRD(prdName, { userStories: prd.userStories });
}

export async function getProgress(prdName) {
	const { join } = await import('node:path');
	const progressPath = join(process.cwd(), '.omni/ralph/prds', prdName, 'progress.txt');
	return await Bun.file(progressPath).text();
}

export async function getPatterns(prdName) {
	const progress = await getProgress(prdName);
	const lines = progress.split('\\n');
	const patterns = [];
	let inPatternsSection = false;

	for (const line of lines) {
		if (line.startsWith('## Codebase Patterns')) {
			inPatternsSection = true;
			continue;
		}
		if (line.startsWith('## ') && inPatternsSection) {
			break;
		}
		if (inPatternsSection && line.startsWith('- ')) {
			patterns.push(line.slice(2));
		}
	}

	return patterns;
}
`;

	await Bun.write(join(capDir, "index.js"), mockModule);
}

describe("PRD Management Commands", () => {
	beforeEach(async () => {
		await runRalphInit();
		await setupRalphCapabilityMock();
	});

	describe("runPrdList", () => {
		test("lists active PRDs", async () => {
			await runPrdCreate({}, "test-prd");

			// Capture console output
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runPrdList({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("test-prd");
		});

		test("shows empty message when no PRDs", async () => {
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runPrdList({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("No active PRDs found");
		});

		test("shows completed PRDs with --all flag", async () => {
			// Create and archive a PRD
			await runPrdCreate({}, "test-prd");
			await runPrdArchive({}, "test-prd");

			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runPrdList({ all: true });

			console.log = originalLog;

			expect(logs.join("\n")).toContain("Completed PRDs");
		});
	});

	describe("runPrdCreate", () => {
		test("creates a new PRD", async () => {
			await runPrdCreate({}, "my-prd");

			const prdPath = join(PRDS_DIR, "my-prd/prd.json");
			expect(existsSync(prdPath)).toBe(true);
		});

		test("sets PRD as active", async () => {
			await runPrdCreate({}, "my-prd");

			const activePath = join(RALPH_DIR, "active-prd");
			const active = await Bun.file(activePath).text();
			expect(active.trim()).toBe("my-prd");
		});
	});

	describe("runPrdSelect", () => {
		test("sets active PRD", async () => {
			await runPrdCreate({}, "prd1");
			await runPrdCreate({}, "prd2");
			await runPrdSelect({}, "prd1");

			const activePath = join(RALPH_DIR, "active-prd");
			const active = await Bun.file(activePath).text();
			expect(active.trim()).toBe("prd1");
		});
	});

	describe("runPrdView", () => {
		test("displays PRD details", async () => {
			await runPrdCreate({}, "test-prd");

			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runPrdView({}, "test-prd");

			console.log = originalLog;

			expect(logs.join("\n")).toContain("test-prd");
			expect(logs.join("\n")).toContain("Branch:");
		});
	});

	describe("runPrdArchive", () => {
		test("moves PRD to completed directory", async () => {
			await runPrdCreate({}, "old-prd");
			await runPrdArchive({}, "old-prd");

			const activePath = join(PRDS_DIR, "old-prd");
			expect(existsSync(activePath)).toBe(false);

			// Check completed directory has the archived PRD
			expect(existsSync(COMPLETED_PRDS_DIR)).toBe(true);
		});
	});
});

describe("Story Management Commands", () => {
	beforeEach(async () => {
		await runRalphInit();
		await setupRalphCapabilityMock();

		// Create a PRD with stories
		await runPrdCreate({}, "test-prd");

		// Add stories manually
		const prdPath = join(PRDS_DIR, "test-prd/prd.json");
		const prd = JSON.parse(await Bun.file(prdPath).text());
		prd.userStories = [
			{
				id: "US-001",
				title: "First story",
				specFile: "specs/001.md",
				scope: "Full",
				acceptanceCriteria: ["Done"],
				priority: 1,
				passes: false,
				notes: "",
			},
		];
		await Bun.write(prdPath, JSON.stringify(prd, null, 2));
	});

	describe("runStoryList", () => {
		test("lists stories in active PRD", async () => {
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runStoryList({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("US-001");
			expect(logs.join("\n")).toContain("First story");
		});
	});

	describe("runStoryPass", () => {
		test("marks story as passed", async () => {
			await runStoryPass({}, "US-001");

			const prdPath = join(PRDS_DIR, "test-prd/prd.json");
			const prd = JSON.parse(await Bun.file(prdPath).text());
			expect(prd.userStories[0]?.passes).toBe(true);
		});
	});

	describe("runStoryReset", () => {
		test("marks story as failed", async () => {
			// First mark as passed
			await runStoryPass({}, "US-001");

			// Then reset
			await runStoryReset({}, "US-001");

			const prdPath = join(PRDS_DIR, "test-prd/prd.json");
			const prd = JSON.parse(await Bun.file(prdPath).text());
			expect(prd.userStories[0]?.passes).toBe(false);
		});
	});

	describe("runStoryAdd", () => {
		test("adds a new story", async () => {
			await runStoryAdd({ spec: "specs/002.md" }, "Second story");

			const prdPath = join(PRDS_DIR, "test-prd/prd.json");
			const prd = JSON.parse(await Bun.file(prdPath).text());
			expect(prd.userStories.length).toBe(2);
			expect(prd.userStories[1]?.id).toBe("US-002");
			expect(prd.userStories[1]?.title).toBe("Second story");
		});
	});
});

describe("Spec Management Commands", () => {
	beforeEach(async () => {
		await runRalphInit();
		await setupRalphCapabilityMock();
		await runPrdCreate({}, "test-prd");
	});

	describe("runSpecList", () => {
		test("lists specs in PRD", async () => {
			const specsDir = join(PRDS_DIR, "test-prd/specs");
			mkdirSync(specsDir, { recursive: true });
			writeFileSync(join(specsDir, "spec1.md"), "# Spec 1");

			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runSpecList({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("spec1.md");
		});

		test("handles no specs directory", async () => {
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runSpecList({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("No specs directory found");
		});
	});

	describe("runSpecCreate", () => {
		test("creates a new spec file", async () => {
			await runSpecCreate({}, "my-spec");

			const specPath = join(PRDS_DIR, "test-prd/specs/my-spec.md");
			expect(existsSync(specPath)).toBe(true);

			const content = await Bun.file(specPath).text();
			expect(content).toContain("# my-spec");
		});

		test("adds .md extension if missing", async () => {
			await runSpecCreate({}, "another-spec");

			const specPath = join(PRDS_DIR, "test-prd/specs/another-spec.md");
			expect(existsSync(specPath)).toBe(true);
		});
	});

	describe("runSpecView", () => {
		test("displays spec content", async () => {
			await runSpecCreate({}, "view-spec");

			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runSpecView({}, "view-spec");

			console.log = originalLog;

			expect(logs.join("\n")).toContain("# view-spec");
		});
	});
});

describe("Utility Commands", () => {
	beforeEach(async () => {
		await runRalphInit();
		await setupRalphCapabilityMock();
		await runPrdCreate({}, "test-prd");
	});

	describe("runLog", () => {
		test("displays progress log", async () => {
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runLog({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("Progress Log");
		});

		test("shows tail with --tail flag", async () => {
			// Add some content to progress
			const progressPath = join(PRDS_DIR, "test-prd/progress.txt");
			await Bun.write(progressPath, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5");

			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runLog({ tail: 2 });

			console.log = originalLog;

			expect(logs.join("\n")).toContain("Line 5");
			expect(logs.join("\n")).not.toContain("Line 1");
		});
	});

	describe("runPatterns", () => {
		test("displays codebase patterns", async () => {
			// Add patterns to progress
			const progressPath = join(PRDS_DIR, "test-prd/progress.txt");
			await Bun.write(
				progressPath,
				"## Codebase Patterns\n\n- Pattern 1\n- Pattern 2\n\n---\n\n## Progress Log\n\n",
			);

			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runPatterns({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("Pattern 1");
			expect(logs.join("\n")).toContain("Pattern 2");
		});

		test("shows message when no patterns", async () => {
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => logs.push(args.join(" "));

			await runPatterns({});

			console.log = originalLog;

			expect(logs.join("\n")).toContain("No patterns documented");
		});
	});
});
