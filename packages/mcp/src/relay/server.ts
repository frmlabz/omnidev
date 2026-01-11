import type { McpController } from "../controller/controller.js";
import type { RelayRequest, RelayResponse, RelayToolsResponse } from "./types.js";

function debug(message: string): void {
	const timestamp = new Date().toISOString();
	console.error(`[${timestamp}] [mcp-relay] ${message}`);
}

export function createRelayServer(
	controller: McpController,
	port: number,
): ReturnType<typeof Bun.serve> {
	debug(`Starting HTTP relay server on port ${port}`);

	return Bun.serve({
		port,
		async fetch(req) {
			const url = new URL(req.url);

			// CORS headers for local development
			const corsHeaders = {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
			};

			// Handle preflight
			if (req.method === "OPTIONS") {
				return new Response(null, { status: 204, headers: corsHeaders });
			}

			try {
				// Route: GET /mcp/status
				if (url.pathname === "/mcp/status" && req.method === "GET") {
					const connections = controller.getAllConnections();
					return Response.json(
						{
							children: connections.map((c) => c.process),
						},
						{ headers: corsHeaders },
					);
				}

				// Route: POST /mcp/:capabilityId/call
				const callMatch = url.pathname.match(/^\/mcp\/([^/]+)\/call$/);
				const callCapabilityId = callMatch?.[1];
				if (callCapabilityId && req.method === "POST") {
					const capabilityId = callCapabilityId;
					const body = (await req.json()) as RelayRequest;

					if (!body.toolName) {
						return Response.json({ success: false, error: "Missing toolName" } as RelayResponse, {
							status: 400,
							headers: corsHeaders,
						});
					}

					debug(`Calling tool ${body.toolName} on ${capabilityId}`);

					try {
						const result = await controller.callTool(
							capabilityId,
							body.toolName,
							body.arguments ?? {},
						);

						return Response.json({ success: true, result } as RelayResponse, {
							headers: corsHeaders,
						});
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						debug(`Tool call failed: ${errorMessage}`);

						return Response.json({ success: false, error: errorMessage } as RelayResponse, {
							status: 500,
							headers: corsHeaders,
						});
					}
				}

				// Route: GET /mcp/:capabilityId/tools
				const toolsMatch = url.pathname.match(/^\/mcp\/([^/]+)\/tools$/);
				const toolsCapabilityId = toolsMatch?.[1];
				if (toolsCapabilityId && req.method === "GET") {
					try {
						const tools = await controller.listTools(toolsCapabilityId);
						return Response.json({ tools } as RelayToolsResponse, { headers: corsHeaders });
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						return Response.json(
							{ success: false, error: errorMessage },
							{ status: 500, headers: corsHeaders },
						);
					}
				}

				// 404 for unmatched routes
				return Response.json(
					{ success: false, error: "Not Found" },
					{ status: 404, headers: corsHeaders },
				);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				debug(`Request error: ${errorMessage}`);

				return Response.json({ success: false, error: errorMessage } as RelayResponse, {
					status: 500,
					headers: corsHeaders,
				});
			}
		},
	});
}
