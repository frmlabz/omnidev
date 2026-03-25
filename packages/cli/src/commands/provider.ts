import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { getAllAdapters } from "@omnidev-ai/adapters";
import { getEnabledAdapters } from "@omnidev-ai/adapters";
import type { ProviderId } from "@omnidev-ai/core";
import {
	disableProvider,
	enableProvider,
	readEnabledProviders,
	syncAgentConfiguration,
} from "@omnidev-ai/core";
import { buildCommand, buildRouteMap } from "@stricli/core";
import { getProviderGitignoreFiles } from "#prompts/provider";

export async function runProviderList() {
	const enabled = await readEnabledProviders();
	const allAdapters = getAllAdapters();

	console.log("Available providers:");
	console.log("");

	for (const adapter of allAdapters) {
		const isEnabled = enabled.includes(adapter.id);
		const marker = isEnabled ? "●" : "○";
		console.log(`  ${marker} ${adapter.displayName} (${adapter.id})`);
	}

	console.log("");
	console.log("Legend: ● enabled, ○ disabled");
}

export async function runProviderEnable(_flags: Record<string, never>, providerId?: string) {
	if (!providerId) {
		console.error("Error: Provider ID is required");
		console.error("Usage: omnidev provider enable <provider-id>");
		process.exit(1);
	}

	const allAdapters = getAllAdapters();
	const adapter = allAdapters.find((a) => a.id === providerId);

	if (!adapter) {
		console.error(`Error: Unknown provider "${providerId}"`);
		console.error("Available providers:");
		for (const a of allAdapters) {
			console.error(`  - ${a.id}`);
		}
		process.exit(1);
	}

	await enableProvider(providerId as ProviderId);
	console.log(`✓ Enabled provider: ${adapter.displayName}`);
	await maybeRemindAboutProviderGitignore(providerId as ProviderId);

	// Sync with newly enabled adapter
	const enabledAdapters = await getEnabledAdapters();
	await syncAgentConfiguration({ silent: false, adapters: enabledAdapters });
}

export async function runProviderDisable(_flags: Record<string, never>, providerId?: string) {
	if (!providerId) {
		console.error("Error: Provider ID is required");
		console.error("Usage: omnidev provider disable <provider-id>");
		process.exit(1);
	}

	const allAdapters = getAllAdapters();
	const adapter = allAdapters.find((a) => a.id === providerId);

	if (!adapter) {
		console.error(`Error: Unknown provider "${providerId}"`);
		console.error("Available providers:");
		for (const a of allAdapters) {
			console.error(`  - ${a.id}`);
		}
		process.exit(1);
	}

	await disableProvider(providerId as ProviderId);
	console.log(`✓ Disabled provider: ${adapter.displayName}`);
}

const listCommand = buildCommand({
	parameters: {
		flags: {},
		positional: { kind: "tuple" as const, parameters: [] },
	},
	docs: {
		brief: "List all providers and their status",
	},
	func: runProviderList,
});

const enableCommand = buildCommand({
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Provider ID to enable",
					parse: String,
					optional: true,
				},
			],
		},
	},
	docs: {
		brief: "Enable a provider",
	},
	func: runProviderEnable,
});

const disableCommand = buildCommand({
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Provider ID to disable",
					parse: String,
					optional: true,
				},
			],
		},
	},
	docs: {
		brief: "Disable a provider",
	},
	func: runProviderDisable,
});

export const providerRoutes = buildRouteMap({
	routes: {
		list: listCommand,
		enable: enableCommand,
		disable: disableCommand,
	},
	docs: {
		brief: "Manage AI provider adapters",
	},
});

async function maybeRemindAboutProviderGitignore(providerId: ProviderId): Promise<void> {
	const missingEntries = await getMissingGitignoreEntries(getProviderGitignoreFiles([providerId]));
	if (missingEntries.length === 0) {
		return;
	}

	console.log("");
	console.log(
		"Also update your .gitignore to ignore provider files if you do not want to commit them:",
	);
	for (const entry of missingEntries) {
		console.log(`  - ${entry}`);
	}
}

async function getMissingGitignoreEntries(entries: string[]): Promise<string[]> {
	if (entries.length === 0) {
		return [];
	}

	let content = "";
	if (existsSync(".gitignore")) {
		content = await readFile(".gitignore", "utf-8");
	}

	const lines = new Set(content.split("\n").map((line) => line.trim()));
	return [...new Set(entries)].filter((entry) => !lines.has(entry));
}
