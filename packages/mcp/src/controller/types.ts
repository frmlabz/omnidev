import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { McpTransport } from "@omnidev/core";

export type McpChildStatus = "starting" | "connected" | "disconnected" | "error";

export interface McpChildProcess {
	capabilityId: string;
	pid: number | null;
	status: McpChildStatus;
	transport: McpTransport;
	lastHealthCheck?: string;
	error?: string;
	toolCount?: number;
	/** Cached tool schemas from MCP discovery */
	tools?: McpToolInfo[];
}

export interface McpConnection {
	capabilityId: string;
	client: Client;
	process: McpChildProcess;
}

export interface McpStatusFile {
	lastUpdated: string;
	relayPort: number;
	children: McpChildProcess[];
}

export interface McpToolInfo {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}
