import type { McpToolInfo } from "../controller/types.js";

/**
 * Convert kebab-case or snake_case to camelCase
 */
function toCamelCase(str: string): string {
	return str.replace(/[-_]([a-z])/g, (_, char) => char.toUpperCase());
}

/**
 * Generate TypeScript type from JSON Schema
 */
function schemaToType(schema: Record<string, unknown>): string {
	const type = schema["type"];

	if (type === "string") return "string";
	if (type === "number" || type === "integer") return "number";
	if (type === "boolean") return "boolean";
	if (type === "null") return "null";
	if (type === "array") {
		const items = schema["items"] as Record<string, unknown> | undefined;
		const itemType = items ? schemaToType(items) : "unknown";
		return `${itemType}[]`;
	}
	if (type === "object") {
		const properties = schema["properties"] as Record<string, Record<string, unknown>> | undefined;
		const required = (schema["required"] as string[]) ?? [];

		if (!properties) return "Record<string, unknown>";

		const fields = Object.entries(properties).map(([key, prop]) => {
			const isRequired = required.includes(key);
			const propType = schemaToType(prop);
			return `${key}${isRequired ? "" : "?"}: ${propType}`;
		});

		return `{ ${fields.join("; ")} }`;
	}

	return "unknown";
}

/**
 * Generate interface for tool parameters
 */
function generateParamsInterface(tool: McpToolInfo): string {
	const schema = tool.inputSchema;
	const properties = schema["properties"] as Record<string, Record<string, unknown>> | undefined;
	const required = (schema["required"] as string[]) ?? [];

	if (!properties || Object.keys(properties).length === 0) {
		return "Record<string, never>";
	}

	const fields = Object.entries(properties).map(([key, prop]) => {
		const isRequired = required.includes(key);
		const propType = schemaToType(prop);
		const description = prop["description"] as string | undefined;
		const comment = description ? `\t/** ${description} */\n` : "";
		return `${comment}\t${key}${isRequired ? "" : "?"}: ${propType};`;
	});

	return `{\n${fields.join("\n")}\n}`;
}

/**
 * Generate a wrapper function for an MCP tool
 */
function generateToolFunction(capabilityId: string, tool: McpToolInfo, relayPort: number): string {
	const funcName = toCamelCase(tool.name);
	const interfaceName = `${funcName.charAt(0).toUpperCase()}${funcName.slice(1)}Args`;
	const paramsInterface = generateParamsInterface(tool);

	return `
/**
 * ${tool.description || tool.name}
 */
export interface ${interfaceName} ${paramsInterface}

export async function ${funcName}(args: ${interfaceName}): Promise<unknown> {
	const response = await fetch(\`http://localhost:${relayPort}/mcp/${capabilityId}/call\`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ toolName: "${tool.name}", arguments: args }),
	});

	const result = await response.json() as { success: boolean; result?: unknown; error?: string };

	if (!result.success) {
		throw new Error(result.error || "Unknown error calling ${tool.name}");
	}

	return result.result;
}`;
}

/**
 * Generate a complete wrapper module for an MCP capability
 */
export function generateWrapperModule(
	capabilityId: string,
	tools: McpToolInfo[],
	relayPort: number,
): string {
	const header = `// Auto-generated MCP wrapper for ${capabilityId}
// Do not edit - regenerated on capability reload
// Generated at: ${new Date().toISOString()}

`;

	const functions = tools.map((tool) => generateToolFunction(capabilityId, tool, relayPort));

	return header + functions.join("\n");
}

/**
 * Generate TypeScript type definitions for an MCP capability
 */
export function generateTypeDefinitions(capabilityId: string, tools: McpToolInfo[]): string {
	const moduleName = capabilityId;

	let dts = `// Auto-generated type definitions for ${capabilityId}
// Generated at: ${new Date().toISOString()}

declare module "${moduleName}" {\n`;

	for (const tool of tools) {
		const funcName = toCamelCase(tool.name);
		const interfaceName = `${funcName.charAt(0).toUpperCase()}${funcName.slice(1)}Args`;
		const paramsInterface = generateParamsInterface(tool);

		dts += `
	/**
	 * ${tool.description || tool.name}
	 */
	export interface ${interfaceName} ${paramsInterface}

	export function ${funcName}(args: ${interfaceName}): Promise<unknown>;
`;
	}

	dts += "}\n";

	return dts;
}
