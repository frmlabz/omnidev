import { existsSync } from "node:fs";
import { buildCommand, buildRouteMap } from "@stricli/core";

const STATUS_FILE = ".omni/state/mcp-status.json";

// Local type definition to avoid circular dependency with @omnidev/mcp
interface McpChildProcess {
	capabilityId: string;
	pid: number | null;
	status: "starting" | "connected" | "disconnected" | "error";
	transport: "stdio" | "sse" | "http";
	lastHealthCheck?: string;
	error?: string;
	toolCount?: number;
}

interface McpStatusFile {
	lastUpdated: string;
	relayPort: number;
	children: McpChildProcess[];
}

/**
 * Run the mcp status command.
 */
export async function runMcpStatus(): Promise<void> {
	try {
		if (!existsSync(STATUS_FILE)) {
			console.log("No MCP status found.");
			console.log("");
			console.log("Is the OmniDev server running? Start it with:");
			console.log("  omnidev serve");
			return;
		}

		const statusText = await Bun.file(STATUS_FILE).text();
		const status = JSON.parse(statusText) as McpStatusFile;

		console.log("");
		console.log("=== MCP Controller Status ===");
		console.log("");
		console.log(`Last updated: ${status.lastUpdated}`);
		console.log(`Relay port:   ${status.relayPort}`);
		console.log("");

		if (status.children.length === 0) {
			console.log("No MCP children running.");
			console.log("");
			console.log("Enable a capability with [mcp] configuration to spawn child MCPs.");
			return;
		}

		console.log(`Child Processes (${status.children.length}):`);
		console.log("");

		for (const child of status.children) {
			const statusIcon = getStatusIcon(child.status);
			console.log(`  ${statusIcon} ${child.capabilityId}`);
			console.log(`      Status:    ${child.status}`);
			console.log(`      Transport: ${child.transport}`);
			if (child.pid) {
				console.log(`      PID:       ${child.pid}`);
			}
			if (child.toolCount !== undefined) {
				console.log(`      Tools:     ${child.toolCount}`);
			}
			if (child.lastHealthCheck) {
				console.log(`      Last check: ${child.lastHealthCheck}`);
			}
			if (child.error) {
				console.log(`      Error:     ${child.error}`);
			}
			console.log("");
		}
	} catch (error) {
		console.error("Error reading MCP status:", error);
		process.exit(1);
	}
}

function getStatusIcon(status: string): string {
	switch (status) {
		case "connected":
			return "\u2713"; // checkmark
		case "starting":
			return "\u2022"; // bullet
		case "disconnected":
			return "\u2717"; // x mark
		case "error":
			return "\u2717"; // x mark
		default:
			return "?";
	}
}

const statusCommand = buildCommand({
	docs: {
		brief: "Show MCP controller status",
	},
	parameters: {},
	async func() {
		await runMcpStatus();
	},
});

export const mcpRoutes = buildRouteMap({
	routes: {
		status: statusCommand,
	},
	docs: {
		brief: "MCP controller commands",
	},
});
