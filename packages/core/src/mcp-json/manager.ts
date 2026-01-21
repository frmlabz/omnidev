import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { LoadedCapability, McpConfig } from "../types";
import type { ResourceManifest } from "../state/manifest";

/**
 * MCP server configuration in .mcp.json for stdio transport
 */
export interface McpServerStdioConfig {
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

/**
 * MCP server configuration in .mcp.json for HTTP transport
 */
export interface McpServerHttpConfig {
	type: "http";
	url: string;
	headers?: Record<string, string>;
}

/**
 * MCP server configuration in .mcp.json for SSE transport
 */
export interface McpServerSseConfig {
	type: "sse";
	url: string;
	headers?: Record<string, string>;
}

/**
 * Union type for all MCP server configurations
 */
export type McpServerConfig = McpServerStdioConfig | McpServerHttpConfig | McpServerSseConfig;

/**
 * Structure of .mcp.json file
 */
export interface McpJsonConfig {
	mcpServers: Record<string, McpServerConfig>;
}

const MCP_JSON_PATH = ".mcp.json";

/**
 * Read .mcp.json or return empty config if doesn't exist
 */
export async function readMcpJson(): Promise<McpJsonConfig> {
	if (!existsSync(MCP_JSON_PATH)) {
		return { mcpServers: {} };
	}

	try {
		const content = await readFile(MCP_JSON_PATH, "utf-8");
		const parsed = JSON.parse(content);
		return {
			mcpServers: parsed.mcpServers || {},
		};
	} catch {
		// If file is invalid JSON, return empty config
		return { mcpServers: {} };
	}
}

/**
 * Write .mcp.json, preserving non-OmniDev entries
 */
export async function writeMcpJson(config: McpJsonConfig): Promise<void> {
	await writeFile(MCP_JSON_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

/**
 * Build MCP server config from capability's mcp section
 */
function buildMcpServerConfig(mcp: McpConfig): McpServerConfig {
	const transport = mcp.transport ?? "stdio";

	// HTTP transport - remote server
	if (transport === "http") {
		if (!mcp.url) {
			throw new Error("HTTP transport requires a URL");
		}
		const config: McpServerHttpConfig = {
			type: "http",
			url: mcp.url,
		};
		if (mcp.headers && Object.keys(mcp.headers).length > 0) {
			config.headers = mcp.headers;
		}
		return config;
	}

	// SSE transport - remote server (deprecated)
	if (transport === "sse") {
		if (!mcp.url) {
			throw new Error("SSE transport requires a URL");
		}
		const config: McpServerSseConfig = {
			type: "sse",
			url: mcp.url,
		};
		if (mcp.headers && Object.keys(mcp.headers).length > 0) {
			config.headers = mcp.headers;
		}
		return config;
	}

	// stdio transport - local process (default)
	if (!mcp.command) {
		throw new Error("stdio transport requires a command");
	}
	const config: McpServerStdioConfig = {
		command: mcp.command,
	};
	if (mcp.args) {
		config.args = mcp.args;
	}
	if (mcp.env) {
		config.env = mcp.env;
	}
	return config;
}

/**
 * Sync .mcp.json with enabled capability MCP servers
 *
 * Each capability with an [mcp] section is registered using its capability ID.
 * Uses the previous manifest to track which MCPs were managed by OmniDev.
 */
export async function syncMcpJson(
	capabilities: LoadedCapability[],
	previousManifest: ResourceManifest,
): Promise<void> {
	const mcpJson = await readMcpJson();

	// Collect all MCP server names from previous manifest
	const previouslyManagedMcps = new Set<string>();
	for (const resources of Object.values(previousManifest.capabilities)) {
		for (const mcpName of resources.mcps) {
			previouslyManagedMcps.add(mcpName);
		}
	}

	// Remove previously managed MCPs
	for (const serverName of previouslyManagedMcps) {
		delete mcpJson.mcpServers[serverName];
	}

	// Add MCPs from all enabled capabilities
	for (const cap of capabilities) {
		if (cap.config.mcp) {
			mcpJson.mcpServers[cap.id] = buildMcpServerConfig(cap.config.mcp);
		}
	}

	await writeMcpJson(mcpJson);
}
