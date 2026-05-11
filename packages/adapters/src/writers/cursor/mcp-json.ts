import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { collectCapabilityMcps, type McpConfig, type SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "#writers/generic/types";
import { createManagedOutput } from "#writers/generic/managed-outputs";

/**
 * Cursor MCP server config format (for `.cursor/mcp.json`)
 *
 * Supports two transport types:
 * - STDIO: Local process using stdin/stdout
 * - Remote (HTTP/SSE): Remote servers via URL
 */
interface CursorMcpServerStdioConfig {
	/** Command to run */
	command: string;
	/** Command arguments */
	args?: string[];
	/** Environment variables */
	env?: Record<string, string>;
}

interface CursorMcpServerRemoteConfig {
	/** URL for remote servers (HTTP or SSE) */
	url: string;
	/** HTTP headers for authentication */
	headers?: Record<string, string>;
}

type CursorMcpServerConfig = CursorMcpServerStdioConfig | CursorMcpServerRemoteConfig;

/**
 * Cursor mcp.json structure
 */
interface CursorMcpJson {
	mcpServers: Record<string, CursorMcpServerConfig>;
}

/**
 * Convert OmniDev McpConfig to Cursor format.
 */
export function buildCursorMcpConfig(mcp: McpConfig): CursorMcpServerConfig | null {
	const transport = mcp.transport ?? "stdio";

	if (transport === "http" || transport === "sse") {
		// Remote transport - use url and headers
		if (!mcp.url) {
			return null;
		}

		const config: CursorMcpServerRemoteConfig = {
			url: mcp.url,
		};

		if (mcp.headers && Object.keys(mcp.headers).length > 0) {
			config.headers = mcp.headers;
		}

		return config;
	}

	// stdio transport - use command, args, env
	if (!mcp.command) {
		return null;
	}

	const config: CursorMcpServerStdioConfig = {
		command: mcp.command,
	};

	if (mcp.args && mcp.args.length > 0) {
		config.args = mcp.args;
	}

	if (mcp.env && Object.keys(mcp.env).length > 0) {
		config.env = mcp.env;
	}

	return config;
}

/**
 * Writer for Cursor mcp.json file.
 *
 * Writes MCP server configurations from the sync bundle to `.cursor/mcp.json`.
 * OmniDev fully manages this file and regenerates it on each sync.
 *
 * Supports:
 * - STDIO servers (command, args, env)
 * - Remote servers via HTTP/SSE (url, headers)
 */
export const CursorMcpJsonWriter: FileWriter = {
	id: "cursor-mcp-json",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		const mcps = collectCapabilityMcps(bundle.capabilities);

		// If no MCPs, don't write the file
		if (mcps.size === 0) {
			return { filesWritten: [] };
		}

		const configPath = join(ctx.projectRoot, ctx.outputPath);

		// Ensure parent directory exists
		const parentDir = dirname(configPath);
		await mkdir(parentDir, { recursive: true });

		// Build the Cursor MCP config
		const mcpServers: Record<string, CursorMcpServerConfig> = {};

		for (const [id, mcp] of mcps) {
			const converted = buildCursorMcpConfig(mcp);
			if (converted) {
				mcpServers[id] = converted;
			}
		}

		// If all MCPs were skipped, don't write the file
		if (Object.keys(mcpServers).length === 0) {
			return { filesWritten: [] };
		}

		const cursorMcpJson: CursorMcpJson = {
			mcpServers,
		};

		// Write the JSON file with pretty formatting
		const content = `${JSON.stringify(cursorMcpJson, null, 2)}\n`;
		await writeFile(configPath, content, "utf-8");

		return {
			filesWritten: [ctx.outputPath],
			managedOutputs: [createManagedOutput(ctx.outputPath, this.id, content)],
		};
	},
};
