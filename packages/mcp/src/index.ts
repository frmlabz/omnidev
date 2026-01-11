/**
 * @omnidev/mcp - MCP server for OmniDev
 *
 * This package provides the Model Context Protocol server that
 * exposes omni_query and omni_execute tools to LLMs.
 */

export type {
	McpChildProcess,
	McpConnection,
	McpStatusFile,
	McpToolInfo,
} from "./controller/index.js";
export { McpController } from "./controller/index.js";
export { createRelayServer } from "./relay/index.js";
export { startServer } from "./server.js";
