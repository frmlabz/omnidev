/**
 * Ralph CLI Commands
 *
 * Core commands for Ralph orchestration: init, start, stop, status
 * Management commands: prd, story, spec, log, patterns
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCommand, buildRouteMap } from "@stricli/core";

const RALPH_DIR = ".omni/ralph";
const PRDS_DIR = join(RALPH_DIR, "prds");
const COMPLETED_PRDS_DIR = join(RALPH_DIR, "completed-prds");
const CONFIG_PATH = join(RALPH_DIR, "config.toml");

const DEFAULT_CONFIG = `[ralph]
default_agent = "claude"
default_iterations = 10
auto_archive = true

[agents.claude]
command = "npx"
args = ["-y", "@anthropic-ai/claude-code", "--model", "sonnet", "--dangerously-skip-permissions", "-p"]

[agents.codex]
command = "npx"
args = ["-y", "@openai/codex", "exec", "-c", "shell_environment_policy.inherit=all", "--dangerously-bypass-approvals-and-sandbox", "-"]

[agents.amp]
command = "amp"
args = ["--dangerously-allow-all"]
`;

/**
 * Initialize Ralph directory structure
 */
export async function runRalphInit(): Promise<void> {
	console.log("Initializing Ralph...");

	// Create directory structure
	mkdirSync(RALPH_DIR, { recursive: true });
	mkdirSync(PRDS_DIR, { recursive: true });
	mkdirSync(COMPLETED_PRDS_DIR, { recursive: true });

	// Create default config if not exists
	if (!existsSync(CONFIG_PATH)) {
		writeFileSync(CONFIG_PATH, DEFAULT_CONFIG);
		console.log(`✓ Created default config at ${CONFIG_PATH}`);
	} else {
		console.log(`✓ Config already exists at ${CONFIG_PATH}`);
	}

	console.log("✓ Ralph initialized successfully");
	console.log("\nNext steps:");
	console.log("  1. Create a PRD: omnidev ralph prd create <name>");
	console.log("  2. Start orchestration: omnidev ralph start");
}

/**
 * Start Ralph orchestration
 */
export async function runRalphStart(flags: {
	agent?: string;
	iterations?: number;
	prd?: string;
}): Promise<void> {
	// Import Ralph capability dynamically
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { loadRalphConfig, getActivePRD, runOrchestration, listPRDs, getPRD } = ralphModule;

	// Load config
	const config = await loadRalphConfig();

	// Determine PRD name
	let prdName = flags.prd;
	if (!prdName) {
		prdName = await getActivePRD();
		if (!prdName) {
			const prds = await listPRDs();
			if (prds.length === 0) {
				console.error("No PRDs found. Create one with: omnidev ralph prd create");
				process.exit(1);
			}
			if (prds.length === 1) {
				prdName = prds[0];
				console.log(`Using only PRD: ${prdName}`);
			} else {
				console.error("Multiple PRDs found. Select one with: omnidev ralph prd select <name>");
				console.error(`Available: ${prds.join(", ")}`);
				process.exit(1);
			}
		}
	}

	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	// Validate PRD exists and has incomplete stories
	const prd = await getPRD(prdName);
	const incompleteStories = prd.userStories.filter((s: { passes: boolean }) => !s.passes);

	if (incompleteStories.length === 0) {
		console.log(`All stories in PRD '${prdName}' are complete!`);
		return;
	}

	// Determine agent
	const agentName = flags.agent ?? config.default_agent;

	// Determine max iterations
	const maxIterations = flags.iterations ?? config.default_iterations;

	// Run orchestration
	await runOrchestration(prdName, agentName, maxIterations);
}

/**
 * Stop Ralph orchestration
 */
export async function runRalphStop(): Promise<void> {
	console.log("Stopping Ralph orchestration...");
	// TODO: Implement process management (US-042 or later)
	console.log("Note: Ralph orchestration runs synchronously in current process.");
	console.log("Use Ctrl+C to stop the current iteration.");
}

/**
 * Show Ralph status
 */
export async function runRalphStatus(flags: { prd?: string }): Promise<void> {
	// Import Ralph capability dynamically
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getActivePRD, getPRD, listPRDs } = ralphModule;

	// Determine PRD name
	let prdName = flags.prd;
	if (!prdName) {
		prdName = await getActivePRD();
	}

	if (!prdName) {
		const prds = await listPRDs();
		if (prds.length === 0) {
			console.log("No PRDs found.");
			console.log("Create one with: omnidev ralph prd create <name>");
			return;
		}

		console.log("No active PRD selected.");
		console.log(`Available PRDs: ${prds.join(", ")}`);
		console.log("Select one with: omnidev ralph prd select <name>");
		return;
	}

	// Load PRD
	const prd = await getPRD(prdName);

	// Calculate progress
	const totalStories = prd.userStories.length;
	const completedStories = prd.userStories.filter((s: { passes: boolean }) => s.passes).length;
	const remainingStories = prd.userStories.filter((s: { passes: boolean }) => !s.passes);

	// Display status
	console.log(`\n=== Ralph Status ===`);
	console.log(`Active PRD: ${prdName}`);
	console.log(`Branch: ${prd.branchName}`);
	console.log(`Description: ${prd.description}`);
	console.log(`\nProgress: ${completedStories}/${totalStories} stories complete`);

	if (remainingStories.length > 0) {
		console.log(`\nRemaining stories:`);
		for (const story of remainingStories) {
			console.log(`  ${story.id}: ${story.title}`);
		}
	} else {
		console.log("\n✓ All stories complete!");
	}
}

/**
 * PRD Management Commands
 */

/**
 * List all PRDs
 */
export async function runPrdList(flags: { all?: boolean }): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { listPRDs, getActivePRD } = ralphModule;

	const activePrds = await listPRDs();
	const activePrdName = await getActivePRD();

	console.log("\n=== Active PRDs ===");
	if (activePrds.length === 0) {
		console.log("No active PRDs found.");
	} else {
		for (const prd of activePrds) {
			const indicator = prd === activePrdName ? "* " : "  ";
			console.log(`${indicator}${prd}`);
		}
	}

	if (flags.all) {
		const completedDir = COMPLETED_PRDS_DIR;
		if (existsSync(completedDir)) {
			const completedPrds = readdirSync(completedDir, { withFileTypes: true })
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);

			if (completedPrds.length > 0) {
				console.log("\n=== Completed PRDs ===");
				for (const prd of completedPrds) {
					console.log(`  ${prd}`);
				}
			}
		}
	}
}

/**
 * Create a new PRD interactively
 */
export async function runPrdCreate(_flags: Record<string, never>, name: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { createPRD, setActivePRD } = ralphModule;

	console.log(`Creating PRD: ${name}`);

	// Get user input for PRD details
	console.log("\nEnter PRD details (press Ctrl+D when done):");

	// For now, create a minimal PRD structure
	// In a real implementation, this would prompt for:
	// - Branch name
	// - Description
	// - Initial stories

	const prd = await createPRD(name, {
		branchName: `feature/${name}`,
		description: "New PRD - edit prd.json to add details",
		userStories: [],
	});

	console.log(`\n✓ Created PRD: ${name}`);
	console.log(`  Branch: ${prd.branchName}`);
	console.log(`  Path: ${PRDS_DIR}/${name}/prd.json`);
	console.log(`\nNext steps:`);
	console.log(`  1. Edit ${PRDS_DIR}/${name}/prd.json to add stories`);
	console.log(`  2. Select this PRD: omnidev ralph prd select ${name}`);
	console.log(`  3. Start orchestration: omnidev ralph start`);

	// Set as active
	await setActivePRD(name);
	console.log(`\n✓ Set as active PRD`);
}

/**
 * Select active PRD
 */
export async function runPrdSelect(_flags: Record<string, never>, name: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { setActivePRD, listPRDs } = ralphModule;

	const prds = await listPRDs();
	if (!prds.includes(name)) {
		console.error(`PRD '${name}' not found.`);
		console.error(`Available PRDs: ${prds.join(", ")}`);
		process.exit(1);
	}

	await setActivePRD(name);
	console.log(`✓ Set active PRD: ${name}`);
}

/**
 * View PRD details
 */
export async function runPrdView(_flags: Record<string, never>, name: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getPRD } = ralphModule;

	const prd = await getPRD(name);

	console.log(`\n=== PRD: ${prd.name} ===`);
	console.log(`Branch: ${prd.branchName}`);
	console.log(`Description: ${prd.description}`);
	console.log(`Created: ${prd.createdAt}`);

	const totalStories = prd.userStories.length;
	const completedStories = prd.userStories.filter((s: { passes: boolean }) => s.passes).length;

	console.log(`\nProgress: ${completedStories}/${totalStories} stories complete`);
	console.log(`\nUser Stories:`);

	for (const story of prd.userStories) {
		const status = story.passes ? "✓" : "✗";
		console.log(`  ${status} ${story.id}: ${story.title}`);
		console.log(`     Priority: ${story.priority}, Spec: ${story.specFile}`);
	}
}

/**
 * Archive PRD
 */
export async function runPrdArchive(_flags: Record<string, never>, name: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { archivePRD } = ralphModule;

	await archivePRD(name);
	console.log(`✓ Archived PRD: ${name} -> ${COMPLETED_PRDS_DIR}/`);
}

/**
 * Delete PRD
 */
export async function runPrdDelete(_flags: Record<string, never>, name: string): Promise<void> {
	// Confirmation - for now just show a message
	// In a real implementation, we would check for a --force flag
	console.log(`WARNING: This will permanently delete PRD '${name}'.`);
	console.log("This action cannot be undone.");
	console.log("\nTo confirm, run: omnidev ralph prd delete --force");
	console.log("(Note: --force flag not yet implemented - delete manually if needed)");

	// TODO: Add confirmation flag and actual deletion in future iteration
	// const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	// const { deletePRD } = ralphModule;
	// await deletePRD(name);

	process.exit(1);
}

/**
 * Story Management Commands
 */

/**
 * List stories in a PRD
 */
export async function runStoryList(flags: { prd?: string }): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getPRD, getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	const prd = await getPRD(prdName);

	console.log(`\n=== Stories in PRD: ${prdName} ===`);

	for (const story of prd.userStories) {
		const status = story.passes ? "✓" : "✗";
		console.log(`${status} ${story.id}: ${story.title}`);
		console.log(`   Priority: ${story.priority}`);
		console.log(`   Spec: ${story.specFile}`);
		console.log(`   Scope: ${story.scope}`);

		if (story.notes) {
			console.log(`   Notes: ${story.notes}`);
		}
		console.log();
	}
}

/**
 * Mark story as passed
 */
export async function runStoryPass(flags: { prd?: string }, storyId: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { markStoryPassed, getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	await markStoryPassed(prdName, storyId);
	console.log(`✓ Marked story ${storyId} as passed in PRD: ${prdName}`);
}

/**
 * Reset story to failed
 */
export async function runStoryReset(flags: { prd?: string }, storyId: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { markStoryFailed, getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	await markStoryFailed(prdName, storyId);
	console.log(`✓ Reset story ${storyId} to failed in PRD: ${prdName}`);
}

/**
 * Add a new story to PRD
 */
export async function runStoryAdd(
	flags: { spec: string; prd?: string },
	title: string,
): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getPRD, updatePRD, getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	const prd = await getPRD(prdName);

	// Generate next story ID
	const existingIds = prd.userStories.map((s: { id: string }) => s.id);
	const maxId = existingIds.reduce((max: number, id: string) => {
		const match = id.match(/US-(\d+)/);
		if (match?.[1]) {
			const num = Number.parseInt(match[1], 10);
			return num > max ? num : max;
		}
		return max;
	}, 0);

	const nextId = `US-${String(maxId + 1).padStart(3, "0")}`;

	// Add story
	const newStory = {
		id: nextId,
		title,
		specFile: flags.spec,
		scope: "Full implementation",
		acceptanceCriteria: ["Implementation complete", "Tests pass", "Quality checks pass"],
		priority: prd.userStories.length + 1,
		passes: false,
		notes: "",
	};

	prd.userStories.push(newStory);
	await updatePRD(prdName, { userStories: prd.userStories });

	console.log(`✓ Added story ${nextId}: ${title}`);
	console.log(`  Spec: ${flags.spec}`);
	console.log(`  Priority: ${newStory.priority}`);
}

/**
 * Spec Management Commands
 */

/**
 * List specs in a PRD
 */
export async function runSpecList(flags: { prd?: string }): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	const specsDir = join(PRDS_DIR, prdName, "specs");

	if (!existsSync(specsDir)) {
		console.log(`No specs directory found for PRD: ${prdName}`);
		console.log(`Create one with: omnidev ralph spec create <name> --prd ${prdName}`);
		return;
	}

	const specs = readdirSync(specsDir, { withFileTypes: true })
		.filter((dirent) => dirent.isFile() && dirent.name.endsWith(".md"))
		.map((dirent) => dirent.name);

	console.log(`\n=== Specs in PRD: ${prdName} ===`);
	if (specs.length === 0) {
		console.log("No specs found.");
	} else {
		for (const spec of specs) {
			console.log(`  ${spec}`);
		}
	}
}

/**
 * Create a new spec file
 */
export async function runSpecCreate(flags: { prd?: string }, name: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	const specsDir = join(PRDS_DIR, prdName, "specs");
	mkdirSync(specsDir, { recursive: true });

	const specPath = join(specsDir, name.endsWith(".md") ? name : `${name}.md`);

	if (existsSync(specPath)) {
		console.error(`Spec already exists: ${specPath}`);
		process.exit(1);
	}

	const template = `# ${name}

## Introduction

[Describe what this specification covers]

## Goals

- [Goal 1]
- [Goal 2]

## Functional Requirements

### FR-1: [Requirement Name]

[Describe the requirement]

## Technical Considerations

[Technical details and patterns]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
`;

	writeFileSync(specPath, template);
	console.log(`✓ Created spec: ${specPath}`);
	console.log(`\nEdit the spec file to add details.`);
}

/**
 * View a spec file
 */
export async function runSpecView(flags: { prd?: string }, name: string): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	const specPath = join(PRDS_DIR, prdName, "specs", name.endsWith(".md") ? name : `${name}.md`);

	if (!existsSync(specPath)) {
		console.error(`Spec not found: ${specPath}`);
		process.exit(1);
	}

	// Read and display spec
	const Bun = (await import("bun")).default;
	const content = await Bun.file(specPath).text();

	console.log(`\n=== Spec: ${name} (PRD: ${prdName}) ===\n`);
	console.log(content);
}

/**
 * Utility Commands
 */

/**
 * View progress log
 */
export async function runLog(flags: { prd?: string; tail?: number }): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getProgress, getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	const progress = await getProgress(prdName);

	if (flags.tail) {
		const lines = progress.split("\n");
		const tailLines = lines.slice(-flags.tail);
		console.log(tailLines.join("\n"));
	} else {
		console.log(progress);
	}
}

/**
 * View codebase patterns
 */
export async function runPatterns(flags: { prd?: string }): Promise<void> {
	const ralphModule = await import(join(process.cwd(), "capabilities/ralph/index.js"));
	const { getPatterns, getActivePRD } = ralphModule;

	const prdName = flags.prd ?? (await getActivePRD());
	if (!prdName) {
		console.error(
			"No PRD specified. Use --prd <name> or select one with: omnidev ralph prd select",
		);
		process.exit(1);
	}

	const patterns = await getPatterns(prdName);

	console.log(`\n=== Codebase Patterns (PRD: ${prdName}) ===\n`);
	if (patterns.length === 0) {
		console.log("No patterns documented yet.");
	} else {
		for (const pattern of patterns) {
			console.log(`- ${pattern}`);
		}
	}
}

// Build commands
const initCommand = buildCommand({
	func: runRalphInit,
	parameters: {},
	docs: {
		brief: "Initialize Ralph directory structure",
	},
});

const startCommand = buildCommand({
	func: runRalphStart,
	parameters: {
		flags: {
			agent: {
				kind: "parsed" as const,
				brief: "Agent to use (default: claude)",
				parse: String,
				optional: true,
			},
			iterations: {
				kind: "parsed" as const,
				brief: "Max iterations (default: 10)",
				parse: Number,
				optional: true,
			},
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
	},
	docs: {
		brief: "Start Ralph orchestration",
	},
});

const stopCommand = buildCommand({
	func: runRalphStop,
	parameters: {},
	docs: {
		brief: "Stop Ralph orchestration",
	},
});

const statusCommand = buildCommand({
	func: runRalphStatus,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
	},
	docs: {
		brief: "Show Ralph status",
	},
});

// PRD Commands
const prdListCommand = buildCommand({
	func: runPrdList,
	parameters: {
		flags: {
			all: {
				kind: "boolean" as const,
				brief: "Include completed PRDs",
				optional: true,
			},
		},
	},
	docs: {
		brief: "List all PRDs",
	},
});

const prdCreateCommand = buildCommand({
	func: runPrdCreate,
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "PRD name",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Create a new PRD",
	},
});

const prdSelectCommand = buildCommand({
	func: runPrdSelect,
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "PRD name",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Select active PRD",
	},
});

const prdViewCommand = buildCommand({
	func: runPrdView,
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "PRD name",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "View PRD details",
	},
});

const prdArchiveCommand = buildCommand({
	func: runPrdArchive,
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "PRD name",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Archive PRD",
	},
});

const prdDeleteCommand = buildCommand({
	func: runPrdDelete,
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "PRD name",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Delete PRD (with confirmation)",
	},
});

const prdRoutes = buildRouteMap({
	routes: {
		list: prdListCommand,
		create: prdCreateCommand,
		select: prdSelectCommand,
		view: prdViewCommand,
		archive: prdArchiveCommand,
		delete: prdDeleteCommand,
	},
	docs: {
		brief: "PRD management commands",
	},
});

// Story Commands
const storyListCommand = buildCommand({
	func: runStoryList,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
	},
	docs: {
		brief: "List stories in a PRD",
	},
});

const storyPassCommand = buildCommand({
	func: runStoryPass,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Story ID",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Mark story as passed",
	},
});

const storyResetCommand = buildCommand({
	func: runStoryReset,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Story ID",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Reset story to failed",
	},
});

const storyAddCommand = buildCommand({
	func: runStoryAdd,
	parameters: {
		flags: {
			spec: {
				kind: "parsed" as const,
				brief: "Spec file path",
				parse: String,
			},
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Story title",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Add a new story to PRD",
	},
});

const storyRoutes = buildRouteMap({
	routes: {
		list: storyListCommand,
		pass: storyPassCommand,
		reset: storyResetCommand,
		add: storyAddCommand,
	},
	docs: {
		brief: "Story management commands",
	},
});

// Spec Commands
const specListCommand = buildCommand({
	func: runSpecList,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
	},
	docs: {
		brief: "List specs in a PRD",
	},
});

const specCreateCommand = buildCommand({
	func: runSpecCreate,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Spec name",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "Create a new spec file",
	},
});

const specViewCommand = buildCommand({
	func: runSpecView,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Spec name",
					parse: String,
				},
			],
		},
	},
	docs: {
		brief: "View a spec file",
	},
});

const specRoutes = buildRouteMap({
	routes: {
		list: specListCommand,
		create: specCreateCommand,
		view: specViewCommand,
	},
	docs: {
		brief: "Spec management commands",
	},
});

// Utility Commands
const logCommand = buildCommand({
	func: runLog,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
			tail: {
				kind: "parsed" as const,
				brief: "Show last N lines",
				parse: Number,
				optional: true,
			},
		},
	},
	docs: {
		brief: "View progress log",
	},
});

const patternsCommand = buildCommand({
	func: runPatterns,
	parameters: {
		flags: {
			prd: {
				kind: "parsed" as const,
				brief: "PRD name (default: active PRD)",
				parse: String,
				optional: true,
			},
		},
	},
	docs: {
		brief: "View codebase patterns",
	},
});

// Export route map
export const ralphRoutes = buildRouteMap({
	routes: {
		init: initCommand,
		start: startCommand,
		stop: stopCommand,
		status: statusCommand,
		prd: prdRoutes,
		story: storyRoutes,
		spec: specRoutes,
		log: logCommand,
		patterns: patternsCommand,
	},
	docs: {
		brief: "Ralph AI orchestrator commands",
	},
});
