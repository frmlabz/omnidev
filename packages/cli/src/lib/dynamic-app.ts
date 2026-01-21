import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { CapabilityExport } from "@omnidev-ai/core";
import { buildApplication, buildRouteMap } from "@stricli/core";
import { addRoutes } from "../commands/add";
import { capabilityRoutes } from "../commands/capability";
// Core commands
import { doctorCommand } from "../commands/doctor";
import { initCommand } from "../commands/init";
import { profileRoutes } from "../commands/profile";
import { providerRoutes } from "../commands/provider";
import { syncCommand } from "../commands/sync";
import { debug } from "@omnidev-ai/core";

const require = createRequire(import.meta.url);

export function readCliVersion(): string {
	try {
		// Path is relative to bundled output at dist/index.js
		const pkg = require("../package.json") as { version?: string };
		if (typeof pkg?.version === "string") {
			return pkg.version;
		}
	} catch {
		// Ignore and fall back to default below.
	}
	return "0.0.0";
}

/**
 * Build CLI app with dynamically loaded capability commands
 */
export async function buildDynamicApp() {
	// Start with core commands
	const routes: Record<string, unknown> = {
		init: initCommand,
		doctor: doctorCommand,
		sync: syncCommand,
		add: addRoutes,
		capability: capabilityRoutes,
		profile: profileRoutes,
		provider: providerRoutes,
	};

	debug("Core routes registered", Object.keys(routes));

	// Only load capability commands if initialized
	const configPath = join(process.cwd(), "omni.toml");
	debug("Checking for config", { configPath, exists: existsSync(configPath), cwd: process.cwd() });

	if (existsSync(configPath)) {
		try {
			debug("Loading capability commands...");
			const capabilityCommands = await loadCapabilityCommands();
			debug("Capability commands loaded", {
				commands: Object.keys(capabilityCommands),
				details: Object.entries(capabilityCommands).map(([name, cmd]) => ({
					name,
					type: typeof cmd,
					// biome-ignore lint/suspicious/noExplicitAny: Debug: access constructor name
					constructor: (cmd as any)?.constructor?.name,
					keys: Object.keys(cmd as object),
					// biome-ignore lint/suspicious/noExplicitAny: Debug: check for method
					hasGetRoutingTargetForInput: typeof (cmd as any)?.getRoutingTargetForInput,
				})),
			});
			Object.assign(routes, capabilityCommands);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn(`Warning: Failed to load capability commands: ${errorMessage}`);
			debug("Full error loading capabilities", error);
			// Continue with core commands only
		}
	}

	debug("Final routes", Object.keys(routes));

	const app = buildApplication(
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
				currentVersion: readCliVersion(),
			},
		},
	);

	debug("App built successfully");

	return app;
}

/**
 * Load CLI commands from enabled capabilities
 */
async function loadCapabilityCommands(): Promise<Record<string, unknown>> {
	const { buildCapabilityRegistry, installCapabilityDependencies } = await import(
		"@omnidev-ai/core"
	);

	// Install dependencies first (silent to avoid noise during CLI startup)
	await installCapabilityDependencies(true);

	const registry = await buildCapabilityRegistry();
	const capabilities = registry.getAllCapabilities();

	debug("Registry built", {
		capabilityCount: capabilities.length,
		capabilities: capabilities.map((c) => ({ id: c.id, path: c.path })),
	});

	const commands: Record<string, unknown> = {};

	for (const capability of capabilities) {
		try {
			debug(`Loading capability '${capability.id}'`, { path: capability.path });
			const capabilityExport = await loadCapabilityExport(capability);

			debug(`Capability '${capability.id}' export`, {
				found: !!capabilityExport,
				hasCLICommands: !!capabilityExport?.cliCommands,
				cliCommands: capabilityExport?.cliCommands ? Object.keys(capabilityExport.cliCommands) : [],
			});

			// Extract CLI commands from structured export
			if (capabilityExport?.cliCommands) {
				for (const [commandName, command] of Object.entries(capabilityExport.cliCommands)) {
					if (commands[commandName]) {
						console.warn(
							`Command '${commandName}' from capability '${capability.id}' conflicts with existing command. Using '${capability.id}' version.`,
						);
					}
					commands[commandName] = command;
					debug(`Registered command '${commandName}' from '${capability.id}'`, {
						type: typeof command,
						// biome-ignore lint/suspicious/noExplicitAny: Debug: access constructor name
						constructor: (command as any)?.constructor?.name,
					});
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
 * Checks for built output (dist/index.js) first, then falls back to index.js or index.ts.
 */
async function loadCapabilityExport(capability: {
	id: string;
	path: string;
}): Promise<CapabilityExport | null> {
	const capabilityPath = join(process.cwd(), capability.path);

	// Check for entry points in order of preference:
	// 1. Built output (dist/index.js) - compiled TypeScript
	// 2. Plain JavaScript (index.js)
	// 3. TypeScript source (index.ts) - only works with TypeScript-aware runtimes
	const builtIndexPath = join(capabilityPath, "dist", "index.js");
	const jsIndexPath = join(capabilityPath, "index.js");
	const tsIndexPath = join(capabilityPath, "index.ts");

	debug(`Checking entry points for '${capability.id}'`, {
		capabilityPath,
		builtIndexPath,
		builtExists: existsSync(builtIndexPath),
		jsIndexPath,
		jsExists: existsSync(jsIndexPath),
		tsIndexPath,
		tsExists: existsSync(tsIndexPath),
	});

	let indexPath: string | null = null;

	if (existsSync(builtIndexPath)) {
		indexPath = builtIndexPath;
	} else if (existsSync(jsIndexPath)) {
		indexPath = jsIndexPath;
	} else if (existsSync(tsIndexPath)) {
		indexPath = tsIndexPath;
	}

	if (!indexPath) {
		debug(`No entry point found for '${capability.id}'`);
		return null;
	}

	debug(`Using entry point for '${capability.id}'`, { indexPath });

	const module = await import(indexPath);

	debug(`Module loaded for '${capability.id}'`, {
		hasDefault: !!module.default,
		moduleKeys: Object.keys(module),
		defaultType: typeof module.default,
		defaultKeys: module.default ? Object.keys(module.default) : [],
	});

	// Get default export (structured capability export)
	if (!module.default) {
		debug(`No default export for '${capability.id}'`);
		return null;
	}

	const capExport = module.default as CapabilityExport;

	// Debug: Log the actual structure of CLI commands
	if (capExport.cliCommands) {
		for (const [name, cmd] of Object.entries(capExport.cliCommands)) {
			debug(`CLI command '${name}' structure`, {
				type: typeof cmd,
				// biome-ignore lint/suspicious/noExplicitAny: Debug: access constructor name
				constructor: (cmd as any)?.constructor?.name,
				keys: Object.keys(cmd as object),
				// biome-ignore lint/suspicious/noExplicitAny: Debug: check for method
				hasGetRoutingTargetForInput: typeof (cmd as any)?.getRoutingTargetForInput,
				// biome-ignore lint/suspicious/noExplicitAny: Debug: access routes property
				routesKeys: (cmd as any).routes ? Object.keys((cmd as any).routes) : undefined,
			});
		}
	}

	return capExport;
}
