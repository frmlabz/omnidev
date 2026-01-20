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
	console.log("Syncing OmniDev configuration...");
	console.log("");

	try {
		const config = await loadConfig();
		const activeProfile = (await getActiveProfile()) ?? config.active_profile ?? "default";

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

		const result = await syncAgentConfiguration({ silent: false, adapters });

		console.log("");
		console.log("✓ Sync completed successfully!");
		console.log("");
		console.log(`Profile: ${activeProfile}`);
		console.log(`Capabilities: ${result.capabilities.join(", ") || "none"}`);
		console.log(`Providers: ${adapters.map((a) => a.displayName).join(", ") || "none"}`);
		console.log("");
		console.log("Synced components:");
		console.log("  • Capability registry");
		console.log("  • Capability sync hooks");
		console.log("  • .omni/.gitignore");
		if (adapters.length > 0) {
			console.log("  • Provider-specific files (instructions embedded)");
		}
	} catch (error) {
		console.error("");
		console.error("✗ Sync failed:");
		console.error(`  ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
