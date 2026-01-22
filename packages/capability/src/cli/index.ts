/**
 * @omnidev-ai/capability CLI
 *
 * Provides commands for capability development:
 * - capability new <id> - Create a new capability
 * - capability build - Build the capability
 */

import { parseArgs } from "node:util";
import { runNew } from "./commands/new.js";
import { runBuild } from "./commands/build.js";

const VERSION = "0.12.0";

function printHelp(): void {
	console.log(`@omnidev-ai/capability v${VERSION}

Usage: capability <command> [options]

Commands:
  new <id>         Create a new capability with template files
  build            Build the capability's TypeScript code

Options:
  -h, --help       Show this help message
  -v, --version    Show version number

Examples:
  capability new my-cap                     Create a basic capability
  capability new my-cap --programmatic      Create with TypeScript + CLI
  capability new my-cap --path ./caps/mine  Create at custom path
  capability build                          Build the capability
  capability build --watch                  Build and watch for changes

For more information, visit: https://omnidev.dev/docs/capabilities
`);
}

function printVersion(): void {
	console.log(VERSION);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	// Handle no arguments
	if (args.length === 0) {
		printHelp();
		process.exit(0);
	}

	// Handle help and version flags at any position
	if (args.includes("-h") || args.includes("--help")) {
		printHelp();
		process.exit(0);
	}

	if (args.includes("-v") || args.includes("--version")) {
		printVersion();
		process.exit(0);
	}

	const command = args[0];

	switch (command) {
		case "new": {
			const { values, positionals } = parseArgs({
				args: args.slice(1),
				options: {
					path: { type: "string", short: "p" },
					programmatic: { type: "boolean" },
					help: { type: "boolean", short: "h" },
				},
				allowPositionals: true,
			});

			if (values.help) {
				console.log(`Create a new capability with template files.

Usage: capability new <id> [options]

Arguments:
  <id>               Capability ID (kebab-case, e.g., my-capability)

Options:
  -p, --path <path>  Output path (default: capabilities/<id>)
  --programmatic     Create with TypeScript + CLI commands
  -h, --help         Show this help message

Examples:
  capability new my-cap
  capability new my-cap --programmatic
  capability new my-cap --path ./custom/location
`);
				process.exit(0);
			}

			if (positionals.length === 0) {
				console.error("Error: Missing capability ID");
				console.log("");
				console.log("  Usage: capability new <id>");
				console.log("  Example: capability new my-cap");
				process.exit(1);
			}

			const capabilityId = positionals[0] as string;
			await runNew(capabilityId, {
				path: values.path,
				programmatic: values.programmatic ?? false,
			});
			break;
		}

		case "build": {
			const { values } = parseArgs({
				args: args.slice(1),
				options: {
					watch: { type: "boolean", short: "w" },
					help: { type: "boolean", short: "h" },
				},
				allowPositionals: false,
			});

			if (values.help) {
				console.log(`Build the capability's TypeScript code.

Usage: capability build [options]

Options:
  -w, --watch        Watch for changes and rebuild
  -h, --help         Show this help message

The build command uses esbuild to compile index.ts to dist/index.js.
Run this command from within a capability directory.

Examples:
  capability build
  capability build --watch
`);
				process.exit(0);
			}

			await runBuild({
				watch: values.watch ?? false,
			});
			break;
		}

		default:
			console.error(`Error: Unknown command '${command}'`);
			console.log("");
			console.log("  Run 'capability --help' for usage information.");
			process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error:", error instanceof Error ? error.message : error);
	process.exit(1);
});
