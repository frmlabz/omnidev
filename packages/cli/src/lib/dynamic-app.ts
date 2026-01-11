import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CapabilityExport } from "@omnidev/core";
import { buildApplication, buildRouteMap } from "@stricli/core";
import { capabilityRoutes } from "../commands/capability";
// Core commands
import { doctorCommand } from "../commands/doctor";
import { initCommand } from "../commands/init";
import { mcpRoutes } from "../commands/mcp";
import { profileRoutes } from "../commands/profile";
import { serveCommand } from "../commands/serve";
import { syncCommand } from "../commands/sync";

/**
 * Build CLI app with dynamically loaded capability commands
 */
export async function buildDynamicApp() {
	// Start with core commands
	const routes: Record<string, unknown> = {
		init: initCommand,
		doctor: doctorCommand,
		serve: serveCommand,
		sync: syncCommand,
		capability: capabilityRoutes,
		profile: profileRoutes,
		mcp: mcpRoutes,
	};

	// Only load capability commands if initialized
	if (existsSync(".omni/config.toml")) {
		try {
			const capabilityCommands = await loadCapabilityCommands();
			Object.assign(routes, capabilityCommands);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn(`Warning: Failed to load capability commands: ${errorMessage}`);
			// Continue with core commands only
		}
	}

	return buildApplication(
		buildRouteMap({
			// biome-ignore lint/suspicious/noExplicitAny: Dynamic commands from capabilities
			routes: routes as any,
			docs: {
				brief: "OmniDev commands",
			},
		}),
		{
			name: "omnidev",
			versionInfo: {
				currentVersion: "0.1.0",
			},
		},
	);
}

/**
 * Load CLI commands from enabled capabilities
 */
async function loadCapabilityCommands(): Promise<Record<string, unknown>> {
	const { buildCapabilityRegistry, installCapabilityDependencies } = await import("@omnidev/core");

	// Install dependencies first (silent to avoid noise during CLI startup)
	await installCapabilityDependencies(true);

	const registry = await buildCapabilityRegistry();
	const capabilities = registry.getAllCapabilities();

	const commands: Record<string, unknown> = {};

	for (const capability of capabilities) {
		try {
			const capabilityExport = await loadCapabilityExport(capability);

			// Extract CLI commands from structured export
			if (capabilityExport?.cliCommands) {
				for (const [commandName, command] of Object.entries(capabilityExport.cliCommands)) {
					if (commands[commandName]) {
						console.warn(
							`Command '${commandName}' from capability '${capability.id}' conflicts with existing command. Using '${capability.id}' version.`,
						);
					}
					commands[commandName] = command;
				}
			}
		} catch (error) {
			console.error(`Failed to load capability '${capability.id}':`, error);
			// Continue loading other capabilities
		}
	}

	return commands;
}

/**
 * Load the default export from a capability
 */
async function loadCapabilityExport(capability: {
	id: string;
	path: string;
}): Promise<CapabilityExport | null> {
	const capabilityPath = join(process.cwd(), capability.path);
	const indexPath = join(capabilityPath, "index.ts");

	if (!existsSync(indexPath)) {
		// Try .js extension
		const jsIndexPath = join(capabilityPath, "index.js");
		if (!existsSync(jsIndexPath)) {
			return null;
		}
		// Use .js path
		const module = await import(jsIndexPath);
		if (!module.default) {
			return null;
		}
		return module.default as CapabilityExport;
	}

	const module = await import(indexPath);

	// Get default export (structured capability export)
	if (!module.default) {
		return null;
	}

	return module.default as CapabilityExport;
}
