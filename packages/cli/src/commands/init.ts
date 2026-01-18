import { exec } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { getAllAdapters, getEnabledAdapters } from "@omnidev-ai/adapters";
import type { ProviderId, ProviderContext } from "@omnidev-ai/core";
import {
	generateOmniMdTemplate,
	loadConfig,
	setActiveProfile,
	syncAgentConfiguration,
	writeConfig,
	writeEnabledProviders,
} from "@omnidev-ai/core";
import { buildCommand } from "@stricli/core";
import {
	getProviderGitignoreFiles,
	promptForGitignoreProviderFiles,
	promptForProviders,
} from "../prompts/provider.js";

const execAsync = promisify(exec);

export async function runInit(_flags: Record<string, never>, providerArg?: string) {
	console.log("Initializing OmniDev...");

	// Create .omni/ directory structure
	mkdirSync(".omni", { recursive: true });
	mkdirSync(".omni/capabilities", { recursive: true });
	mkdirSync(".omni/state", { recursive: true });

	// Update root .gitignore to ignore .omni/ and omni.local.toml
	await updateRootGitignore();

	// Get provider selection
	let providerIds: ProviderId[];
	const isInteractive = !providerArg;
	if (providerArg) {
		providerIds = parseProviderArg(providerArg);
	} else {
		providerIds = await promptForProviders();
	}

	// Ask about gitignoring provider files (only in interactive mode)
	if (isInteractive) {
		const shouldIgnoreProviderFiles = await promptForGitignoreProviderFiles(providerIds);
		if (shouldIgnoreProviderFiles) {
			const filesToIgnore = getProviderGitignoreFiles(providerIds);
			await addProviderFilesToGitignore(filesToIgnore);

			// Check which files are already tracked in git
			const trackedFiles = await getTrackedProviderFiles(filesToIgnore);
			if (trackedFiles.length > 0) {
				console.log("");
				console.log("⚠️  Some provider files are already tracked in git.");
				console.log("   Run the following to stop tracking them:");
				console.log("");
				console.log(`   git rm --cached ${trackedFiles.join(" ")}`);
				console.log("");
			}
		}
	}

	// Save enabled providers to local state (not omni.toml)
	await writeEnabledProviders(providerIds);

	// Create omni.toml at project root (without provider config - that's in state)
	if (!existsSync("omni.toml")) {
		await writeConfig({
			profiles: {
				default: {
					capabilities: [],
				},
				planning: {
					capabilities: [],
				},
				coding: {
					capabilities: [],
				},
			},
		});
		// Set active profile in state file
		await setActiveProfile("default");
	}

	// Create OMNI.md - the user's project instructions file
	if (!existsSync("OMNI.md")) {
		await writeFile("OMNI.md", generateOmniMdTemplate(), "utf-8");
	}

	// Load config and create provider context
	const config = await loadConfig();
	const ctx: ProviderContext = {
		projectRoot: process.cwd(),
		config,
	};

	// Initialize enabled adapters
	const allAdapters = getAllAdapters();
	const selectedAdapters = allAdapters.filter((a) => providerIds.includes(a.id));

	for (const adapter of selectedAdapters) {
		if (adapter.init) {
			await adapter.init(ctx);
		}
	}

	// Run initial sync with enabled adapters (silent - no need to show details)
	const enabledAdapters = await getEnabledAdapters();
	await syncAgentConfiguration({ silent: true, adapters: enabledAdapters });

	// Output success message
	console.log("");
	console.log(
		`✓ OmniDev initialized for ${selectedAdapters.map((a) => a.displayName).join(" and ")}!`,
	);
	console.log("");

	// Show message about OMNI.md
	console.log("📝 Add your project description and instructions to OMNI.md");
	console.log(
		"   This will be transformed into provider-specific files (CLAUDE.md, AGENTS.md, etc.)",
	);
	console.log("");
	console.log("💡 Run 'omnidev capability list' to see available capabilities.");
}

export const initCommand = buildCommand({
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "AI provider(s): claude-code, cursor, codex, opencode, or comma-separated",
					parse: String,
					optional: true,
				},
			],
		},
	},
	docs: {
		brief: "Initialize OmniDev in the current project",
	},
	func: runInit,
});

function parseProviderArg(arg: string): ProviderId[] {
	const allAdapters = getAllAdapters();
	const validIds = new Set(allAdapters.map((a) => a.id));

	// Handle legacy "both" argument
	if (arg.toLowerCase() === "both") {
		return ["claude-code", "cursor"];
	}

	// Handle comma-separated list
	const parts = arg.split(",").map((p) => p.trim().toLowerCase());
	const result: ProviderId[] = [];

	for (const part of parts) {
		// Map legacy names
		let id = part;
		if (id === "claude") {
			id = "claude-code";
		}

		if (!validIds.has(id)) {
			throw new Error(`Invalid provider: ${part}. Valid providers: ${[...validIds].join(", ")}`);
		}
		result.push(id as ProviderId);
	}

	return result;
}

async function updateRootGitignore(): Promise<void> {
	const entriesToAdd = [".omni/", "omni.local.toml"];
	await addToGitignore(entriesToAdd, "OmniDev");
}

async function addProviderFilesToGitignore(entries: string[]): Promise<void> {
	await addToGitignore(entries, "OmniDev Provider Files");
}

async function addToGitignore(entriesToAdd: string[], sectionHeader: string): Promise<void> {
	const gitignorePath = ".gitignore";

	let content = "";
	if (existsSync(gitignorePath)) {
		content = await readFile(gitignorePath, "utf-8");
	}

	const lines = content.split("\n");
	const missingEntries = entriesToAdd.filter(
		(entry) => !lines.some((line) => line.trim() === entry),
	);

	if (missingEntries.length === 0) {
		return;
	}

	// Add a newline before our section if the file doesn't end with one
	const needsNewline = content.length > 0 && !content.endsWith("\n");
	const section = `${needsNewline ? "\n" : ""}# ${sectionHeader}\n${missingEntries.join("\n")}\n`;

	await writeFile(gitignorePath, content + section, "utf-8");
}

async function getTrackedProviderFiles(files: string[]): Promise<string[]> {
	const tracked: string[] = [];

	for (const file of files) {
		try {
			// git ls-files returns the file path if tracked, empty string if not
			const { stdout } = await execAsync(`git ls-files "${file}"`);
			if (stdout.trim()) {
				tracked.push(file);
			}
		} catch {
			// Not in a git repo or git not available - skip
		}
	}

	return tracked;
}
