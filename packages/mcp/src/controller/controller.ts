import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { LoadedCapability } from "@omnidev/core";
import type { McpChildProcess, McpConnection, McpStatusFile, McpToolInfo } from "./types.js";

const STATUS_FILE = ".omni/state/mcp-status.json";
const HEALTH_CHECK_INTERVAL = 30_000; // 30 seconds

function debug(message: string): void {
	const timestamp = new Date().toISOString();
	console.error(`[${timestamp}] [mcp-controller] ${message}`);
}

export class McpController {
	private connections: Map<string, McpConnection> = new Map();
	private childProcesses: Map<string, ChildProcess> = new Map();
	private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
	private relayPort: number = 9876;

	constructor() {
		this.startHealthMonitor();
	}

	setRelayPort(port: number): void {
		this.relayPort = port;
	}

	async spawnChild(capability: LoadedCapability): Promise<void> {
		const mcpConfig = capability.config.mcp;
		if (!mcpConfig) {
			throw new Error(`Capability ${capability.id} does not have an MCP configuration`);
		}

		const transport = mcpConfig.transport ?? "stdio";

		// Check if already connected
		if (this.connections.has(capability.id)) {
			debug(`MCP ${capability.id} already connected, skipping spawn`);
			return;
		}

		debug(`Spawning MCP child for ${capability.id} (transport: ${transport})`);

		const childInfo: McpChildProcess = {
			capabilityId: capability.id,
			pid: null,
			status: "starting",
			transport,
		};

		try {
			if (transport === "stdio") {
				await this.spawnStdioChild(capability, childInfo);
			} else if (transport === "sse") {
				throw new Error("SSE transport not yet implemented");
			} else if (transport === "http") {
				throw new Error("HTTP transport not yet implemented");
			} else {
				throw new Error(`Unknown transport: ${transport}`);
			}
		} catch (error) {
			childInfo.status = "error";
			childInfo.error = error instanceof Error ? error.message : String(error);
			debug(`Failed to spawn MCP ${capability.id}: ${childInfo.error}`);

			// Still add to connections map so we can track the error
			this.connections.set(capability.id, {
				capabilityId: capability.id,
				client: null as unknown as Client,
				process: childInfo,
			});
		}

		await this.writeStatus();
	}

	private async spawnStdioChild(
		capability: LoadedCapability,
		childInfo: McpChildProcess,
	): Promise<void> {
		const mcpConfig = capability.config.mcp;
		if (!mcpConfig) {
			throw new Error(`Capability ${capability.id} does not have an MCP configuration`);
		}

		// Build environment
		const env: Record<string, string> = {
			...process.env,
			...mcpConfig.env,
		} as Record<string, string>;

		// Spawn the child process
		const childProcess = spawn(mcpConfig.command, mcpConfig.args ?? [], {
			cwd: mcpConfig.cwd ?? process.cwd(),
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		childInfo.pid = childProcess.pid ?? null;
		this.childProcesses.set(capability.id, childProcess);

		// Handle process errors
		childProcess.on("error", (error) => {
			debug(`MCP ${capability.id} process error: ${error.message}`);
			const conn = this.connections.get(capability.id);
			if (conn) {
				conn.process.status = "error";
				conn.process.error = error.message;
			}
			this.writeStatus();
		});

		childProcess.on("exit", (code, signal) => {
			debug(`MCP ${capability.id} process exited with code ${code}, signal ${signal}`);
			const conn = this.connections.get(capability.id);
			if (conn) {
				conn.process.status = "disconnected";
				conn.process.error = `Process exited with code ${code}`;
			}
			this.childProcesses.delete(capability.id);
			this.writeStatus();
		});

		// Create the MCP client transport
		const transport = new StdioClientTransport({
			command: mcpConfig.command,
			args: mcpConfig.args ?? [],
			env,
			cwd: mcpConfig.cwd ?? process.cwd(),
		});

		// Create and connect the client
		const client = new Client({
			name: `omnidev-${capability.id}`,
			version: "1.0.0",
		});

		await client.connect(transport);

		// Get and cache tool schemas
		const toolsResult = await client.listTools();
		childInfo.tools = toolsResult.tools.map((tool) => ({
			name: tool.name,
			description: tool.description ?? "",
			inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {},
		}));
		childInfo.toolCount = childInfo.tools.length;
		childInfo.status = "connected";
		childInfo.lastHealthCheck = new Date().toISOString();

		debug(`MCP ${capability.id} connected successfully with ${childInfo.toolCount} tools`);

		this.connections.set(capability.id, {
			capabilityId: capability.id,
			client,
			process: childInfo,
		});
	}

	async stopChild(capabilityId: string): Promise<void> {
		const connection = this.connections.get(capabilityId);
		if (!connection) {
			debug(`No connection found for ${capabilityId}`);
			return;
		}

		debug(`Stopping MCP child ${capabilityId}`);

		try {
			// Close the client connection
			if (connection.client) {
				await connection.client.close();
			}
		} catch (error) {
			debug(
				`Error closing client for ${capabilityId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Kill the child process
		const childProcess = this.childProcesses.get(capabilityId);
		if (childProcess) {
			childProcess.kill("SIGTERM");
			this.childProcesses.delete(capabilityId);
		}

		this.connections.delete(capabilityId);
		await this.writeStatus();
	}

	async stopAll(): Promise<void> {
		debug("Stopping all MCP children");

		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}

		const stopPromises = Array.from(this.connections.keys()).map((id) => this.stopChild(id));

		await Promise.all(stopPromises);
		debug("All MCP children stopped");
	}

	async callTool(
		capabilityId: string,
		toolName: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		const connection = this.connections.get(capabilityId);
		if (!connection) {
			throw new Error(`No MCP connection for capability: ${capabilityId}`);
		}

		if (connection.process.status !== "connected") {
			throw new Error(
				`MCP ${capabilityId} is not connected (status: ${connection.process.status})`,
			);
		}

		debug(`Calling tool ${toolName} on ${capabilityId}`);

		const result = await connection.client.callTool({
			name: toolName,
			arguments: args,
		});

		return result;
	}

	async listTools(capabilityId: string): Promise<McpToolInfo[]> {
		const connection = this.connections.get(capabilityId);
		if (!connection) {
			throw new Error(`No MCP connection for capability: ${capabilityId}`);
		}

		if (connection.process.status !== "connected") {
			throw new Error(
				`MCP ${capabilityId} is not connected (status: ${connection.process.status})`,
			);
		}

		const result = await connection.client.listTools();

		return result.tools.map((tool) => ({
			name: tool.name,
			description: tool.description ?? "",
			inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {},
		}));
	}

	getConnection(capabilityId: string): McpConnection | undefined {
		return this.connections.get(capabilityId);
	}

	getAllConnections(): McpConnection[] {
		return Array.from(this.connections.values());
	}

	/**
	 * Sync capabilities - stop removed MCPs and start new ones
	 */
	async syncCapabilities(capabilities: LoadedCapability[]): Promise<void> {
		const newMcpCapabilities = new Set(capabilities.filter((c) => c.config.mcp).map((c) => c.id));

		// Stop MCPs that are no longer in the capability list
		for (const [id] of this.connections) {
			if (!newMcpCapabilities.has(id)) {
				debug(`Capability ${id} removed, stopping MCP`);
				await this.stopChild(id);
			}
		}

		// Start new MCPs
		for (const cap of capabilities) {
			if (cap.config.mcp && !this.connections.has(cap.id)) {
				debug(`New MCP capability ${cap.id}, spawning`);
				await this.spawnChild(cap);
			}
		}
	}

	private startHealthMonitor(): void {
		this.healthCheckTimer = setInterval(async () => {
			for (const [id, connection] of this.connections) {
				if (connection.process.status === "connected") {
					try {
						// Simple health check - list tools
						await connection.client.listTools();
						connection.process.lastHealthCheck = new Date().toISOString();
					} catch (error) {
						debug(
							`Health check failed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
						);
						connection.process.status = "error";
						connection.process.error = "Health check failed";
					}
				}
			}
			await this.writeStatus();
		}, HEALTH_CHECK_INTERVAL);
	}

	private async writeStatus(): Promise<void> {
		const status: McpStatusFile = {
			lastUpdated: new Date().toISOString(),
			relayPort: this.relayPort,
			children: Array.from(this.connections.values()).map((c) => c.process),
		};

		try {
			await mkdir(".omni/state", { recursive: true });
			await writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
		} catch (error) {
			debug(
				`Failed to write status file: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
