import type { CapabilityConfig, LoadedCapability, McpConfig } from "../types";

export interface CapabilityMcpEntry {
	name: string;
	config: McpConfig;
	capabilityId: string;
}

export function getCapabilityMcpEntries(
	capabilityId: string,
	config: CapabilityConfig,
): CapabilityMcpEntry[] {
	const entries: CapabilityMcpEntry[] = [];

	if (config.mcp) {
		entries.push({
			name: capabilityId,
			config: config.mcp,
			capabilityId,
		});
	}

	for (const [name, mcp] of Object.entries(config.mcps ?? {})) {
		entries.push({
			name,
			config: mcp,
			capabilityId,
		});
	}

	return entries;
}

export function collectCapabilityMcps(capabilities: LoadedCapability[]): Map<string, McpConfig> {
	const mcps = new Map<string, McpConfig>();
	const owners = new Map<string, string>();

	for (const capability of capabilities) {
		for (const entry of getCapabilityMcpEntries(capability.id, capability.config)) {
			const existingOwner = owners.get(entry.name);
			if (existingOwner) {
				throw new Error(
					`Duplicate MCP server name "${entry.name}" from capabilities "${existingOwner}" and "${entry.capabilityId}"`,
				);
			}

			owners.set(entry.name, entry.capabilityId);
			mcps.set(entry.name, entry.config);
		}
	}

	return mcps;
}
