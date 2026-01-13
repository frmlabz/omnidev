/**
 * MCP Server for OmniDev
 *
 * Provides omni_query and omni_execute tools to LLMs via Model Context Protocol
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildCapabilityRegistry } from "@omnidev/core";
import * as z from "zod";
import { McpController } from "./controller/index.js";
import { createRelayServer } from "./relay/index.js";
import { setupMcpWrappers, setupSandbox } from "./sandbox.js";
import { handleOmniExecute } from "./tools/execute.js";
// import { handleOmniQuery } from "./tools/query.js"; // DISABLED
import { handleSandboxEnvironment } from "./tools/sandbox-environment.js";
import { startWatcher } from "./watcher.js";
import { findFreePort } from "./utils/net.js";

const LOG_FILE = ".omni/logs/mcp-server.log";

/**
 * Debug logger that writes to stderr and log file
 */
function debug(message: string, data?: unknown): void {
	const timestamp = new Date().toISOString();
	let logLine: string;

	if (data !== undefined) {
		logLine = `[${timestamp}] [omnidev] ${message} ${JSON.stringify(data, null, 2)}`;
	} else {
		logLine = `[${timestamp}] [omnidev] ${message}`;
	}

	// Write to stderr
	console.error(logLine);

	// Write to log file
	try {
		mkdirSync(".omni/logs", { recursive: true });
		appendFileSync(LOG_FILE, `${logLine}\n`);
	} catch (error) {
		// If logging fails, just continue
		console.error(`Failed to write to log file: ${error}`);
	}
}

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
	try {
		debug("Starting MCP server...");

		// Build capability registry
		debug("Building capability registry...");
		let registry: Awaited<ReturnType<typeof buildCapabilityRegistry>>;
		try {
			registry = await buildCapabilityRegistry();
			debug(`Capability registry built with ${registry.getAllCapabilities().length} capabilities`);
		} catch (error) {
			debug("Failed to build capability registry", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		}

		// Create MCP server instance
		debug("Creating MCP server instance...");
		const server = new McpServer({
			name: "omnidev",
			version: "0.1.0",
		});

		// Register omni_query tool (simple search)
		// DISABLED: Commented out for now
		// debug("Registering omni_query tool...");
		// server.registerTool(
		// 	"omni_query",
		// 	{
		// 		title: "Search OmniDev",
		// 		description:
		// 			"Search capabilities, docs, skills, and rules. Use omni_sandbox_environment for tool introspection.",
		// 		inputSchema: {
		// 			query: z
		// 				.string()
		// 				.optional()
		// 				.describe("Search query. Empty returns summary of enabled capabilities."),
		// 		},
		// 	},
		// 	async (args) => {
		// 		debug("omni_query tool called", args);
		// 		try {
		// 			const result = await handleOmniQuery(registry, args);
		// 			debug("omni_query tool completed successfully");
		// 			return result;
		// 		} catch (error) {
		// 			debug("omni_query tool failed", {
		// 				error: error instanceof Error ? error.message : String(error),
		// 				stack: error instanceof Error ? error.stack : undefined,
		// 			});
		// 			throw error;
		// 		}
		// 	},
		// );

		// Register omni_sandbox_environment tool
		debug("Registering omni_sandbox_environment tool...");
		server.registerTool(
			"omni_sandbox_environment",
			{
				title: "Sandbox Environment",
				description:
					"Discover available sandbox tools. No params = overview, capability = module details, capability + tool = full specification.",
				inputSchema: {
					capability: z
						.string()
						.optional()
						.describe("Capability ID to get details for. Omit for overview of all modules."),
					tool: z
						.string()
						.optional()
						.describe("Tool name to get full specification. Requires capability."),
				},
			},
			async (args) => {
				debug("omni_sandbox_environment tool called", args);
				try {
					const result = await handleSandboxEnvironment(registry, args);
					debug("omni_sandbox_environment tool completed successfully");
					return result;
				} catch (error) {
					debug("omni_sandbox_environment tool failed", {
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					});
					throw error;
				}
			},
		);

		// Register omni_execute tool
		debug("Registering omni_execute tool...");
		server.registerTool(
			"omni_execute",
			{
				title: "Execute TypeScript Code",
				description: "Execute TypeScript code in the sandbox with access to capability modules.",
				inputSchema: {
					code: z
						.string()
						.describe(
							"Full TypeScript file contents with export async function main(): Promise<number>",
						),
				},
			},
			async (args) => {
				debug("omni_execute tool called", { codeLength: args.code?.length });
				try {
					const result = await handleOmniExecute(registry, args);
					debug("omni_execute tool completed successfully");
					return result;
				} catch (error) {
					debug("omni_execute tool failed", {
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					});
					throw error;
				}
			},
		);

		// Setup sandbox symlinks
		debug("Setting up sandbox symlinks...");
		await setupSandbox(registry.getAllCapabilities());
		debug("Sandbox setup complete");

		// Initialize MCP controller for child MCP servers
		debug("Initializing MCP controller...");
		const mcpController = new McpController();

		// Start HTTP relay server for sandbox->MCP communication
		// Find a free port starting from 10000
		const RELAY_PORT = await findFreePort(10000);

		mcpController.setRelayPort(RELAY_PORT);
		// Keep reference to prevent GC, but we don't need to use it directly
		const _relayServer = createRelayServer(mcpController, RELAY_PORT);
		void _relayServer;
		await Bun.write(".omni/state/relay-port", RELAY_PORT.toString());
		debug(`HTTP relay server started on port ${RELAY_PORT}`);

		// Spawn child MCPs for capabilities with [mcp] section
		const mcpCapabilities = registry.getAllCapabilities().filter((c) => c.config.mcp);
		debug(`Found ${mcpCapabilities.length} MCP capabilities to spawn`);

		for (const cap of mcpCapabilities) {
			try {
				await mcpController.spawnChild(cap);
			} catch (error) {
				debug(`Failed to spawn MCP for ${cap.id}`, {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Generate MCP wrappers for sandbox
		debug("Generating MCP wrappers for sandbox...");
		await setupMcpWrappers(registry.getAllCapabilities(), mcpController, RELAY_PORT);
		debug("MCP wrappers generated");

		// Write PID file
		debug("Writing PID file...");
		mkdirSync(".omni/state", { recursive: true });
		await Bun.write(".omni/state/server.pid", process.pid.toString());
		debug(`PID file written: ${process.pid}`);

		// Start file watcher for hot reload
		debug("Starting file watcher...");
		startWatcher(async () => {
			debug("Reloading capabilities...");
			registry = await buildCapabilityRegistry();
			await setupSandbox(registry.getAllCapabilities());

			// Sync MCP children (stop removed, start new)
			await mcpController.syncCapabilities(registry.getAllCapabilities());

			// Regenerate MCP wrappers
			await setupMcpWrappers(registry.getAllCapabilities(), mcpController, RELAY_PORT);

			debug("Capabilities reloaded");
		});

		// Handle shutdown
		const shutdown = async () => {
			debug("Shutting down...");

			// Stop all MCP children
			try {
				await mcpController.stopAll();
			} catch (error) {
				debug("Error stopping MCP children", {
					error: error instanceof Error ? error.message : String(error),
				});
			}

			try {
				const pidFile = Bun.file(".omni/state/server.pid");
				await pidFile.delete();
			} catch {
				// Ignore errors if file doesn't exist
			}
			process.exit(0);
		};

		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);

		// Handle uncaught errors to prevent silent crashes
		process.on("uncaughtException", (error) => {
			debug("Uncaught exception", {
				error: error.message,
				stack: error.stack,
			});
			// Don't exit, let the server continue
		});

		process.on("unhandledRejection", (reason) => {
			debug("Unhandled rejection", {
				reason: reason instanceof Error ? reason.message : String(reason),
				stack: reason instanceof Error ? reason.stack : undefined,
			});
			// Don't exit, let the server continue
		});

		// Start MCP server with stdio transport
		debug("Creating stdio transport...");
		const transport = new StdioServerTransport();

		debug("Connecting server to transport...");
		await server.connect(transport);

		debug("MCP server started and ready to accept requests");
	} catch (error) {
		debug("Fatal error during server startup", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		throw error;
	}
}
