/**
 * @omnidev-ai/cli - Command-line interface for OmniDev
 *
 * This package provides the CLI for managing OmniDev configuration
 * and capabilities.
 */

import { run } from "@stricli/core";
import { buildDynamicApp } from "./lib/dynamic-app";
import { debug } from "./lib/debug";

// Build app dynamically based on enabled capabilities
const app = await buildDynamicApp();

debug("CLI startup", {
	arguments: process.argv.slice(2),
	cwd: process.cwd(),
});

// Run CLI with error handling
try {
	run(app, process.argv.slice(2), {
		// biome-ignore lint/suspicious/noExplicitAny: Stricli expects a process-like object with stdin/stdout/stderr
		process: process as any,
	});
} catch (error) {
	// Provide helpful error messages instead of cryptic stack traces
	if (error instanceof Error) {
		// Check if it's a routing error (command not found)
		if (
			error.message.includes("getRoutingTargetForInput") ||
			error.stack?.includes("@stricli/core")
		) {
			const args = process.argv.slice(2);
			console.error(`\nError: Command not found or invalid usage.`);

			if (args.length > 0) {
				console.error(`\nYou tried to run: omnidev ${args.join(" ")}`);
				console.error("\nThis could mean:");
				console.error("  1. The command doesn't exist");
				console.error("  2. A required capability is not enabled");
				console.error("  3. Invalid command syntax\n");
			}

			console.error("Run 'omnidev --help' to see available commands");
			console.error("\nTo enable capabilities, run: omnidev capability enable <name>");
			console.error("To see enabled capabilities: omnidev capability list");
			process.exit(1);
		} else {
			// Re-throw other errors
			throw error;
		}
	}
}
