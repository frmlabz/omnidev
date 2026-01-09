/**
 * MCP Server for OmniDev
 *
 * Provides omni_query and omni_execute tools to LLMs via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildCapabilityRegistry } from '@omnidev/core';
import { handleOmniQuery } from './tools/query.js';
import { handleOmniExecute } from './tools/execute.js';

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
	// Build capability registry
	const registry = await buildCapabilityRegistry();

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
			tools: [
				{
					name: 'omni_query',
					description:
						'Search capabilities, docs, and skills. Returns type definitions when include_types is true.',
					inputSchema: {
						type: 'object',
						properties: {
							query: {
								type: 'string',
								description: 'Search query. Empty returns summary of enabled capabilities.',
							},
							limit: {
								type: 'number',
								description: 'Maximum results to return (default: 10)',
							},
							include_types: {
								type: 'boolean',
								description: 'Include TypeScript type definitions in response',
							},
						},
					},
				},
				{
					name: 'omni_execute',
					description: 'Execute TypeScript code in the sandbox with access to capability modules.',
					inputSchema: {
						type: 'object',
						properties: {
							code: {
								type: 'string',
								description:
									'Full TypeScript file contents with export async function main(): Promise<number>',
							},
						},
						required: ['code'],
					},
				},
			],
		};
	});

	// Register call tool handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		try {
			switch (name) {
				case 'omni_query':
					return await handleOmniQuery(registry, args);
				case 'omni_execute':
					return await handleOmniExecute(registry, args);
				default:
					throw new Error(`Unknown tool: ${name}`);
			}
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
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
