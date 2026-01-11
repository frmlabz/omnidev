/**
 * omni_sandbox_environment tool implementation
 *
 * Provides introspection of the sandbox environment - all available tools,
 * their schemas, and full specifications.
 *
 * Three levels of detail:
 * 1. No params: Overview of all modules and tools (short descriptions)
 * 2. capability: Details for that module (input/output schemas)
 * 3. capability + tool: Full specification (JSDoc, examples, detailed docs)
 */

import { existsSync, readFileSync } from "node:fs";
import type { CapabilityRegistry, JSONSchema, SandboxToolExport } from "@omnidev/core";

const MCP_STATUS_FILE = ".omni/state/mcp-status.json";

/**
 * Tool info from MCP status file
 */
interface McpToolInfo {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

/**
 * MCP status file structure
 */
interface McpStatusFile {
	lastUpdated: string;
	relayPort: number;
	children: Array<{
		capabilityId: string;
		status: "starting" | "connected" | "disconnected" | "error";
		tools?: McpToolInfo[];
	}>;
}

interface SandboxEnvironmentArgs {
	capability?: string;
	tool?: string;
}

/**
 * Unified tool info for both native and MCP tools
 */
interface ToolInfo {
	name: string;
	description: string;
	inputSchema: JSONSchema;
	outputSchema?: JSONSchema | undefined;
	specification?: string | undefined;
	source: "native" | "mcp";
}

/**
 * Module info with all its tools
 */
interface ModuleInfo {
	capabilityId: string;
	moduleName: string;
	description: string;
	tools: ToolInfo[];
	source: "native" | "mcp";
}

/**
 * Read MCP status file
 */
function readMcpStatusFile(): McpStatusFile | null {
	try {
		if (!existsSync(MCP_STATUS_FILE)) {
			return null;
		}
		const content = readFileSync(MCP_STATUS_FILE, "utf-8");
		return JSON.parse(content) as McpStatusFile;
	} catch {
		return null;
	}
}

/**
 * Get all modules with their tools
 */
function getAllModules(registry: CapabilityRegistry): ModuleInfo[] {
	const modules: ModuleInfo[] = [];
	const seenCapabilities = new Set<string>();

	// Source 1: Native capabilities with sandboxTools
	for (const cap of registry.getAllCapabilities()) {
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic exports
		const exports = cap.exports as any;
		const sandboxTools = exports?.default?.sandboxTools as
			| Record<string, SandboxToolExport>
			| undefined;

		if (sandboxTools && Object.keys(sandboxTools).length > 0) {
			const moduleName = cap.config.exports?.module ?? cap.id;
			modules.push({
				capabilityId: cap.id,
				moduleName,
				description: cap.config.capability.description,
				tools: Object.values(sandboxTools).map((tool) => ({
					name: tool.name,
					description: tool.description,
					inputSchema: tool.inputSchema,
					outputSchema: tool.outputSchema,
					specification: tool.specification,
					source: "native" as const,
				})),
				source: "native",
			});
			seenCapabilities.add(cap.id);
		}
	}

	// Source 2: MCP wrapper capabilities
	const statusFile = readMcpStatusFile();
	if (statusFile) {
		for (const child of statusFile.children) {
			if (seenCapabilities.has(child.capabilityId)) continue;
			if (child.status !== "connected" || !child.tools?.length) continue;

			const cap = registry.getCapability(child.capabilityId);
			const moduleName = cap?.config.exports?.module ?? child.capabilityId;
			const description = cap?.config.capability.description ?? "MCP capability";

			modules.push({
				capabilityId: child.capabilityId,
				moduleName,
				description,
				tools: child.tools.map((tool) => ({
					name: tool.name,
					description: tool.description,
					inputSchema: tool.inputSchema as JSONSchema,
					source: "mcp" as const,
				})),
				source: "mcp",
			});
		}
	}

	return modules;
}

/**
 * Format JSON Schema as TypeScript-like type string
 */
function schemaToTypeString(schema: JSONSchema): string {
	if (!schema || Object.keys(schema).length === 0) {
		return "unknown";
	}

	const type = schema["type"];

	if (Array.isArray(type)) {
		return type.map((t) => primitiveToType(t as string)).join(" | ");
	}

	switch (type) {
		case "string":
			if (schema["enum"]) {
				return (schema["enum"] as string[]).map((v) => `"${v}"`).join(" | ");
			}
			return "string";
		case "number":
		case "integer":
			return "number";
		case "boolean":
			return "boolean";
		case "null":
			return "null";
		case "array": {
			const items = schema["items"] as JSONSchema | undefined;
			if (items) {
				return `${schemaToTypeString(items)}[]`;
			}
			return "unknown[]";
		}
		case "object": {
			const properties = schema["properties"] as Record<string, JSONSchema> | undefined;
			if (!properties) {
				return "Record<string, unknown>";
			}
			const required = new Set((schema["required"] as string[]) ?? []);
			const lines: string[] = [];
			for (const [propName, propSchema] of Object.entries(properties)) {
				const optional = required.has(propName) ? "" : "?";
				const propType = schemaToTypeString(propSchema);
				const desc = propSchema.description ? ` // ${propSchema.description}` : "";
				lines.push(`  ${propName}${optional}: ${propType};${desc}`);
			}
			return `{\n${lines.join("\n")}\n}`;
		}
		default:
			return "unknown";
	}
}

function primitiveToType(type: string): string {
	switch (type) {
		case "string":
			return "string";
		case "number":
		case "integer":
			return "number";
		case "boolean":
			return "boolean";
		case "null":
			return "null";
		default:
			return "unknown";
	}
}

/**
 * Format overview response (no params)
 */
function formatOverview(modules: ModuleInfo[]): string {
	if (modules.length === 0) {
		return "No sandbox modules available.\n\nEnable capabilities with sandbox tools to see them here.";
	}

	const lines: string[] = ["# Sandbox Environment", ""];
	lines.push(`Available modules: ${modules.length}`, "");

	for (const mod of modules) {
		const tag = mod.source === "mcp" ? " [MCP]" : "";
		lines.push(`## ${mod.moduleName}${tag}`);
		lines.push(`${mod.description}`, "");
		lines.push("Tools:");
		for (const tool of mod.tools) {
			lines.push(`  - ${tool.name}: ${tool.description}`);
		}
		lines.push("");
	}

	lines.push("---");
	lines.push('Use omni_sandbox_environment({ capability: "<name>" }) for detailed schemas.');

	return lines.join("\n");
}

/**
 * Format capability details response
 */
function formatCapabilityDetails(mod: ModuleInfo): string {
	const lines: string[] = [];
	const tag = mod.source === "mcp" ? " [MCP]" : "";

	lines.push(`# Module: ${mod.moduleName}${tag}`);
	lines.push(`${mod.description}`, "");
	lines.push(`\`\`\`typescript`);
	lines.push(`import * as ${mod.moduleName} from "${mod.moduleName}";`);
	lines.push(`\`\`\``, "");

	lines.push("## Tools", "");

	for (const tool of mod.tools) {
		lines.push(`### ${tool.name}`);
		lines.push(tool.description, "");

		lines.push("**Input:**");
		lines.push("```typescript");
		lines.push(schemaToTypeString(tool.inputSchema));
		lines.push("```", "");

		if (tool.outputSchema) {
			lines.push("**Output:**");
			lines.push("```typescript");
			lines.push(schemaToTypeString(tool.outputSchema));
			lines.push("```", "");
		}

		lines.push("");
	}

	lines.push("---");
	lines.push(
		`Use omni_sandbox_environment({ capability: "${mod.capabilityId}", tool: "<name>" }) for full specification.`,
	);

	return lines.join("\n");
}

/**
 * Format tool details response
 */
function formatToolDetails(mod: ModuleInfo, tool: ToolInfo): string {
	const lines: string[] = [];
	const tag = mod.source === "mcp" ? " [MCP]" : "";

	lines.push(`# ${mod.moduleName}.${tool.name}${tag}`);
	lines.push(tool.description, "");

	if (tool.specification) {
		lines.push("## Specification");
		lines.push("```");
		lines.push(tool.specification);
		lines.push("```", "");
	}

	lines.push("## Input Schema");
	lines.push("```typescript");
	lines.push(schemaToTypeString(tool.inputSchema));
	lines.push("```", "");

	if (tool.outputSchema) {
		lines.push("## Output Schema");
		lines.push("```typescript");
		lines.push(schemaToTypeString(tool.outputSchema));
		lines.push("```", "");
	}

	lines.push("## JSON Schema (Input)");
	lines.push("```json");
	lines.push(JSON.stringify(tool.inputSchema, null, 2));
	lines.push("```");

	if (tool.outputSchema) {
		lines.push("", "## JSON Schema (Output)");
		lines.push("```json");
		lines.push(JSON.stringify(tool.outputSchema, null, 2));
		lines.push("```");
	}

	lines.push("", "## Usage Example");
	lines.push("```typescript");
	lines.push(`import { ${tool.name} } from "${mod.moduleName}";`);
	lines.push("");
	lines.push(`const result = await ${tool.name}({`);

	// Generate example call from schema
	const props = tool.inputSchema["properties"] as Record<string, JSONSchema> | undefined;
	const required = new Set((tool.inputSchema["required"] as string[]) ?? []);
	if (props) {
		for (const [propName, propSchema] of Object.entries(props)) {
			if (required.has(propName)) {
				const example = getExampleValue(propSchema);
				lines.push(`  ${propName}: ${example},`);
			}
		}
	}

	lines.push("});");
	lines.push("```");

	return lines.join("\n");
}

/**
 * Get an example value for a schema property
 */
function getExampleValue(schema: JSONSchema): string {
	const type = schema["type"];

	if (schema["enum"]) {
		return JSON.stringify((schema["enum"] as unknown[])[0]);
	}

	if (schema["default"] !== undefined) {
		return JSON.stringify(schema["default"]);
	}

	switch (type) {
		case "string":
			return '"..."';
		case "number":
		case "integer":
			return "0";
		case "boolean":
			return "true";
		case "array":
			return "[]";
		case "object":
			return "{}";
		default:
			return "null";
	}
}

/**
 * Handle omni_sandbox_environment tool calls
 */
export async function handleSandboxEnvironment(
	registry: CapabilityRegistry,
	args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	const { capability, tool } = (args as SandboxEnvironmentArgs) || {};

	const modules = getAllModules(registry);

	let response: string;

	if (!capability) {
		// Level 1: Overview
		response = formatOverview(modules);
	} else {
		// Find the module
		const mod = modules.find((m) => m.capabilityId === capability || m.moduleName === capability);

		if (!mod) {
			response = `Error: Capability "${capability}" not found.\n\nAvailable: ${modules.map((m) => m.capabilityId).join(", ")}`;
		} else if (!tool) {
			// Level 2: Capability details
			response = formatCapabilityDetails(mod);
		} else {
			// Level 3: Tool details
			const toolInfo = mod.tools.find((t) => t.name === tool);

			if (!toolInfo) {
				response = `Error: Tool "${tool}" not found in capability "${capability}".\n\nAvailable tools: ${mod.tools.map((t) => t.name).join(", ")}`;
			} else {
				response = formatToolDetails(mod, toolInfo);
			}
		}
	}

	return {
		content: [
			{
				type: "text",
				text: response,
			},
		],
	};
}
