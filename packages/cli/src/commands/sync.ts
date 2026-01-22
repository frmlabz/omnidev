import { existsSync } from "node:fs";
import { getEnabledAdapters } from "@omnidev-ai/adapters";
import type { ProviderContext } from "@omnidev-ai/core";
import {
	getActiveProfile,
	loadConfig,
	syncAgentConfiguration,
	writeEnabledProviders,
} from "@omnidev-ai/core";
import { buildCommand } from "@stricli/core";
import { promptForProviders } from "../prompts/provider.js";
import { initializeAdaptersForProviders } from "./init.js";

const PROVIDERS_STATE_PATH = ".omni/state/providers.json";

export const syncCommand = buildCommand({
	docs: {
		brief: "Manually sync all capabilities, roles, and instructions",
	},
	parameters: {},
	async func() {
		return await runSync();
	},
});

export async function runSync(): Promise<void> {
	try {
		const config = await loadConfig();
		const activeProfile = (await getActiveProfile()) ?? "default";

		// Get enabled adapters for provider-specific sync
		let adapters = await getEnabledAdapters();

		if (!existsSync(PROVIDERS_STATE_PATH) || adapters.length === 0) {
			console.log("No providers configured yet. Select your provider(s):");
			const providerIds = await promptForProviders();
			await writeEnabledProviders(providerIds);

			const ctx: ProviderContext = {
				projectRoot: process.cwd(),
				config,
			};

			adapters = await initializeAdaptersForProviders(providerIds, ctx);
			console.log("");
		}

		// Show profile and providers at the top
		const providerNames = adapters.map((a) => a.displayName).join(", ") || "none";
		console.log(`Profile: ${activeProfile} | Providers: ${providerNames}`);
		console.log("");
		console.log("Syncing...");

		const result = await syncAgentConfiguration({ silent: true, adapters });

		// Show each synced capability on its own line
		for (const capId of result.capabilities) {
			console.log(`  ✓ ${capId}`);
		}

		// Show total
		console.log("");
		console.log(`Total: ${result.capabilities.length} synced`);
	} catch (error) {
		console.error("");
		console.error("✗ Sync failed:");
		console.error(`  ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
