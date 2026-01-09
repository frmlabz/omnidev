import { buildCommand } from "@stricli/core";
import { existsSync } from "node:fs";
import { setActiveProfile } from "@omnidev/core";

interface ServeFlags {
	profile?: string;
}

export async function runServe(flags: ServeFlags): Promise<void> {
	console.log("Starting OmniDev MCP server...");

	// Check if OmniDev is initialized
	if (!existsSync(".omni")) {
		console.error("✗ OmniDev not initialized. Run: omnidev init");
		process.exit(1);
	}

	// Set profile if provided
	if (flags.profile) {
		console.log(`Setting profile to: ${flags.profile}`);
		try {
			// Validate profile exists in config
			const { loadConfig } = await import("@omnidev/core");
			const config = await loadConfig();
			if (!config.profiles?.[flags.profile]) {
				console.error(`✗ Profile "${flags.profile}" not found in config`);
				process.exit(1);
			}
			await setActiveProfile(flags.profile);
		} catch (error) {
			console.error(`✗ Failed to set profile: ${error}`);
			process.exit(1);
		}
	}

	// Import and start the MCP server
	try {
		const { startServer } = await import("@omnidev/mcp");
		console.log("✓ Server starting...");
		await startServer();
	} catch (error) {
		console.error(`✗ Failed to start server: ${error}`);
		process.exit(1);
	}
}

export const serveCommand = buildCommand({
	docs: {
		brief: "Start the OmniDev MCP server",
		fullDescription: "Starts the MCP server that exposes omni_query and omni_execute tools to LLMs",
	},
	parameters: {
		flags: {
			profile: {
				kind: "parsed" as const,
				parse: String,
				brief: "Set active profile before starting server",
				optional: true,
			},
		},
	},
	func: runServe,
});
