/**
 * MCP Server for OmniDev
 *
 * Provides omni_query and omni_execute tools to LLMs via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
	// Create MCP server instance
	const server = new Server(
		{
			name: 'omnidev',
			version: '0.1.0',
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	// Register list tools handler
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: [],
		};
	});

	// Register call tool handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name } = request.params;
		throw new Error(`Unknown tool: ${name}`);
	});

	// Handle shutdown
	const shutdown = async () => {
		console.error('[omnidev] Shutting down...');
		process.exit(0);
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	// Start MCP server with stdio transport
	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error('[omnidev] MCP server started');
}
