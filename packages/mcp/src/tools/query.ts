/**
 * omni_query tool implementation
 *
 * Simple search across capabilities, skills, docs, and rules.
 * For sandbox environment and tool introspection, use omni_sandbox_environment.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import type { CapabilityRegistry } from "@omnidev/core";

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
}

/**
 * Handle omni_query tool calls
 *
 * Simple search across capabilities, skills, docs, and rules.
 * Returns matching results as a list.
 *
 * @param registry - Capability registry to search
 * @param args - Query arguments (just query string)
 * @returns MCP tool response with search results
 */
export async function handleOmniQuery(
	registry: CapabilityRegistry,
	args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	const { query = "" } = (args as QueryArgs) || {};

	debug("Query received", { query });

	const results: string[] = [];

	// If no query, return summary of all capabilities
	if (!query.trim()) {
		debug("Empty query - returning capability summary");
		const capabilities = registry.getAllCapabilities();
		results.push(`Enabled capabilities (${capabilities.length}):`);
		for (const cap of capabilities) {
			results.push(`  - ${cap.id}: ${cap.config.capability.description}`);
		}
		results.push("");
		results.push("Use omni_sandbox_environment to discover available tools.");
	} else {
		debug(`Searching for: "${query}"`);

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

		// Search rules
		for (const rule of registry.getAllRules()) {
			if (
				rule.name.toLowerCase().includes(queryLower) ||
				rule.content.toLowerCase().includes(queryLower)
			) {
				const snippet = rule.content.slice(0, 100).replace(/\n/g, " ");
				results.push(`[rule:${rule.capabilityId}/${rule.name}] ${snippet}...`);
			}
		}
	}

	debug(`Returning ${results.length} results`);

	return {
		content: [
			{
				type: "text",
				text: results.join("\n"),
			},
		],
	};
}
