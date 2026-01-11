/**
 * omni_query tool implementation
 *
 * Searches across capabilities, skills, and docs. Returns type definitions when requested.
 */

import type { CapabilityRegistry } from "@omnidev/core";
import { mkdirSync, appendFileSync } from "node:fs";

const LOG_FILE = ".omni/logs/mcp-server.log";

function debug(message: string, data?: unknown): void {
	const timestamp = new Date().toISOString();
	let logLine: string;

	if (data !== undefined) {
		logLine = `[${timestamp}] [omnidev:query] ${message} ${JSON.stringify(data, null, 2)}`;
	} else {
		logLine = `[${timestamp}] [omnidev:query] ${message}`;
	}

	console.error(logLine);

	try {
		mkdirSync(".omni/logs", { recursive: true });
		appendFileSync(LOG_FILE, `${logLine}\n`);
	} catch (error) {
		console.error(`Failed to write to log file: ${error}`);
	}
}

interface QueryArgs {
	query?: string;
	limit?: number;
	include_types?: boolean;
}

/**
 * Handle omni_query tool calls
 *
 * @param registry - Capability registry to search
 * @param args - Query arguments (query, limit, include_types)
 * @returns MCP tool response with search results
 */
export async function handleOmniQuery(
	registry: CapabilityRegistry,
	args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	const { query = "", limit = 10, include_types = false } = (args as QueryArgs) || {};

	debug("Query received", { query, limit, include_types });

	const results: string[] = [];

	// If no query, return summary
	if (!query.trim()) {
		debug("Empty query - returning capability summary");
		const capabilities = registry.getAllCapabilities();
		results.push(`Enabled capabilities (${capabilities.length}):`);
		for (const cap of capabilities) {
			results.push(`  - ${cap.id}: ${cap.config.capability.description}`);
		}
	} else {
		debug(`Searching for: "${query}"`);

		// Search capabilities, skills, docs
		const queryLower = query.toLowerCase();

		// Search capabilities
		for (const cap of registry.getAllCapabilities()) {
			if (
				cap.id.toLowerCase().includes(queryLower) ||
				cap.config.capability.description.toLowerCase().includes(queryLower)
			) {
				results.push(`[capability:${cap.id}] ${cap.config.capability.description}`);
			}
		}

		// Search skills
		for (const skill of registry.getAllSkills()) {
			if (
				skill.name.toLowerCase().includes(queryLower) ||
				skill.description.toLowerCase().includes(queryLower)
			) {
				results.push(`[skill:${skill.capabilityId}/${skill.name}] ${skill.description}`);
			}
		}

		// Search docs
		for (const doc of registry.getAllDocs()) {
			if (
				doc.name.toLowerCase().includes(queryLower) ||
				doc.content.toLowerCase().includes(queryLower)
			) {
				const snippet = doc.content.slice(0, 100).replace(/\n/g, " ");
				results.push(`[doc:${doc.capabilityId}/${doc.name}] ${snippet}...`);
			}
		}
	}

	// Add type definitions if explicitly requested
	let typeDefinitions = "";
	if (include_types) {
		debug("Generating type definitions for tool-enabled capabilities");
		typeDefinitions = generateTypeDefinitions(registry);
	}

	const limitedResults = results.slice(0, limit);
	let response = limitedResults.join("\n");

	if (typeDefinitions) {
		response += `\n\n--- Type Definitions ---\n\n${typeDefinitions}`;
	}

	debug(`Returning ${limitedResults.length} results (limit: ${limit})`);

	return {
		content: [
			{
				type: "text",
				text: response,
			},
		],
	};
}

/**
 * Generate TypeScript type definitions for capabilities with tools
 *
 * Only includes type definitions for capabilities that export mcpTools,
 * since those are the only types relevant for sandbox execution.
 * CLI-only capabilities are filtered out.
 *
 * @param registry - Capability registry
 * @returns TypeScript type definitions as string
 */
function generateTypeDefinitions(registry: CapabilityRegistry): string {
	let dts = "// Auto-generated type definitions for sandbox tools\n";
	dts += "// Only includes capabilities that export mcpTools\n\n";

	let hasToolCapabilities = false;
	const allCapabilities = registry.getAllCapabilities();

	debug(`Checking ${allCapabilities.length} capabilities for mcpTools`);

	for (const cap of allCapabilities) {
		// Skip capabilities that don't have mcpTools
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic exports need runtime type checking
		const exports = cap.exports as any;
		const toolCount = exports?.mcpTools ? Object.keys(exports.mcpTools).length : 0;

		if (toolCount === 0) {
			debug(`Skipping ${cap.id} - no mcpTools (has ${Object.keys(exports || {}).join(", ")})`);
			continue;
		}

		debug(`Including ${cap.id} - has ${toolCount} mcpTools`);
		hasToolCapabilities = true;
		const moduleName = cap.config.exports?.module ?? cap.id;
		dts += `declare module '${moduleName}' {\n`;

		if (cap.typeDefinitions) {
			// Indent each line
			const indented = cap.typeDefinitions
				.split("\n")
				.map((line) => `  ${line}`)
				.join("\n");
			dts += indented;
		} else {
			dts += "  // No type definitions available\n";
		}

		dts += "\n}\n\n";
	}

	if (!hasToolCapabilities) {
		debug("No capabilities with tools found");
		dts += "// No capabilities with tools are currently enabled\n";
	}

	return dts;
}
