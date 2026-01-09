/**
 * @omnidev/mcp - MCP server for OmniDev
 *
 * This package provides the Model Context Protocol server that
 * exposes omni_query and omni_execute tools to LLMs.
 */

import { getVersion } from '@omnidev/core';

export function startServer(): void {
	console.log(`OmniDev MCP Server v${getVersion()}`);
}
