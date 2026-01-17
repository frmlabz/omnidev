import { existsSync, mkdirSync } from "node:fs";
import { getAllAdapters, getEnabledAdapters } from "@omnidev-ai/adapters";
import type { ProviderId, ProviderContext } from "@omnidev-ai/core";
import {
	generateInstructionsTemplate,
	loadConfig,
	setActiveProfile,
	syncAgentConfiguration,
	writeConfig,
	writeEnabledProviders,
} from "@omnidev-ai/core";
import { buildCommand } from "@stricli/core";
import { promptForProviders } from "../prompts/provider.js";

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
	if (providerArg) {
		providerIds = parseProviderArg(providerArg);
	} else {
		providerIds = await promptForProviders();
	}

	// Save enabled providers to local state (not omni.toml)
	await writeEnabledProviders(providerIds);

	// Create omni.toml at project root (without provider config - that's in state)
	if (!existsSync("omni.toml")) {
		await writeConfig({
			project: "my-project",
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

	// Create .omni/instructions.md
	if (!existsSync(".omni/instructions.md")) {
		await Bun.write(".omni/instructions.md", generateInstructionsTemplate());
	}

	// Load config and create provider context
	const config = await loadConfig();
	const ctx: ProviderContext = {
		projectRoot: process.cwd(),
		config,
	};

	// Initialize enabled adapters (create their root files)
	const allAdapters = getAllAdapters();
	const selectedAdapters = allAdapters.filter((a) => providerIds.includes(a.id));
	const filesCreated: string[] = [];
	const filesExisting: string[] = [];

	for (const adapter of selectedAdapters) {
		if (adapter.init) {
			const result = await adapter.init(ctx);
			if (result.filesCreated) {
				filesCreated.push(...result.filesCreated);
			}
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

	// Show appropriate message based on file status
	if (filesCreated.length > 0) {
		console.log("📝 Don't forget to add your project description to:");
		console.log("   • .omni/instructions.md");
	}

	if (filesExisting.length > 0) {
		console.log("📝 Add this line to your existing file(s):");
		for (const file of filesExisting) {
			console.log(`   • ${file}: @import .omni/instructions.md`);
		}
	}

	console.log("");
	console.log("💡 Recommendation:");
	console.log("   Add provider-specific files to .gitignore:");
	console.log("   CLAUDE.md, .claude/, AGENTS.md, .cursor/, .mcp.json");
	console.log("");
	console.log("   Run 'omnidev capability list' to see available capabilities.");
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
	const gitignorePath = ".gitignore";
	const entriesToAdd = [".omni/", "omni.local.toml"];

	let content = "";
	if (existsSync(gitignorePath)) {
		content = await Bun.file(gitignorePath).text();
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
	const section = `${needsNewline ? "\n" : ""}# OmniDev\n${missingEntries.join("\n")}\n`;

	await Bun.write(gitignorePath, content + section);
}
