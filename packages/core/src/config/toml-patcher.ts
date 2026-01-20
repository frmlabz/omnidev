import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { CapabilitySourceConfig, McpConfig } from "../types/index.js";

const CONFIG_PATH = "omni.toml";

/**
 * Read the raw TOML file content
 */
async function readConfigFile(): Promise<string> {
	if (!existsSync(CONFIG_PATH)) {
		return "";
	}
	return readFile(CONFIG_PATH, "utf-8");
}

/**
 * Write content to the config file
 */
async function writeConfigFile(content: string): Promise<void> {
	await writeFile(CONFIG_PATH, content, "utf-8");
}

/**
 * Find the line index where a TOML section starts
 * @returns The line index or -1 if not found
 */
function findSection(lines: string[], sectionPattern: RegExp): number {
	return lines.findIndex((line) => sectionPattern.test(line.trim()));
}

/**
 * Find the end of a TOML section (next section start or end of file)
 */
function findSectionEnd(lines: string[], startIndex: number): number {
	// Look for the next section header after the start
	for (let i = startIndex + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const trimmed = line.trim();
		// Check if this is a new section (but not a subsection of current)
		if (/^\[(?!\[)/.test(trimmed) && !trimmed.startsWith("#")) {
			return i;
		}
	}
	return lines.length;
}

/**
 * Format a capability source for TOML
 */
function formatCapabilitySource(name: string, source: CapabilitySourceConfig): string {
	if (typeof source === "string") {
		return `${name} = "${source}"`;
	}
	if ("path" in source && source.path) {
		return `${name} = { source = "${source.source}", path = "${source.path}" }`;
	}
	return `${name} = "${source.source}"`;
}

/**
 * Add a capability source to [capabilities.sources]
 */
export async function patchAddCapabilitySource(
	name: string,
	source: CapabilitySourceConfig,
): Promise<void> {
	let content = await readConfigFile();
	const lines = content.split("\n");

	// Find [capabilities.sources] section
	const sectionIndex = findSection(lines, /^\[capabilities\.sources\]$/);

	const newEntry = formatCapabilitySource(name, source);

	if (sectionIndex !== -1) {
		// Section exists, add entry after section header
		const sectionEnd = findSectionEnd(lines, sectionIndex);
		// Insert before the end of section (or before blank lines at end)
		let insertIndex = sectionEnd;
		// Find a good insertion point (after last non-blank, non-comment line in section)
		for (let i = sectionEnd - 1; i > sectionIndex; i--) {
			const line = lines[i];
			if (line === undefined) continue;
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith("#")) {
				insertIndex = i + 1;
				break;
			}
		}
		// If we only found the header, insert right after it
		if (insertIndex === sectionEnd && sectionIndex + 1 < lines.length) {
			insertIndex = sectionIndex + 1;
		}
		lines.splice(insertIndex, 0, newEntry);
	} else {
		// Section doesn't exist, need to create it
		// Try to find [capabilities] section first
		const capabilitiesIndex = findSection(lines, /^\[capabilities\]$/);

		if (capabilitiesIndex !== -1) {
			// Insert after [capabilities] section
			const capEnd = findSectionEnd(lines, capabilitiesIndex);
			lines.splice(capEnd, 0, "", "[capabilities.sources]", newEntry);
		} else {
			// No capabilities section at all, add at end
			// Find a good place - after mcps or at end
			const mcpsIndex = findSection(lines, /^\[mcps/);
			if (mcpsIndex !== -1) {
				// Insert before mcps
				lines.splice(mcpsIndex, 0, "[capabilities.sources]", newEntry, "");
			} else {
				// Just append at end
				lines.push("", "[capabilities.sources]", newEntry);
			}
		}
	}

	content = lines.join("\n");
	await writeConfigFile(content);
}

/**
 * Format an MCP config as TOML lines
 */
function formatMcpConfig(name: string, config: McpConfig): string[] {
	const lines: string[] = [];
	lines.push(`[mcps.${name}]`);

	// Transport (only if not stdio, since stdio is default)
	if (config.transport && config.transport !== "stdio") {
		lines.push(`transport = "${config.transport}"`);
	}

	// For stdio transport
	if (config.command) {
		lines.push(`command = "${config.command}"`);
	}
	if (config.args && config.args.length > 0) {
		const argsStr = config.args.map((a) => `"${a}"`).join(", ");
		lines.push(`args = [${argsStr}]`);
	}
	if (config.cwd) {
		lines.push(`cwd = "${config.cwd}"`);
	}

	// For http/sse transport
	if (config.url) {
		lines.push(`url = "${config.url}"`);
	}

	// Environment variables
	if (config.env && Object.keys(config.env).length > 0) {
		lines.push(`[mcps.${name}.env]`);
		for (const [key, value] of Object.entries(config.env)) {
			lines.push(`${key} = "${value}"`);
		}
	}

	// Headers
	if (config.headers && Object.keys(config.headers).length > 0) {
		lines.push(`[mcps.${name}.headers]`);
		for (const [key, value] of Object.entries(config.headers)) {
			lines.push(`${key} = "${value}"`);
		}
	}

	return lines;
}

/**
 * Add an MCP server configuration
 */
export async function patchAddMcp(name: string, config: McpConfig): Promise<void> {
	let content = await readConfigFile();
	const lines = content.split("\n");

	const mcpLines = formatMcpConfig(name, config);

	// Find any existing [mcps.*] section to add near it
	const existingMcpIndex = findSection(lines, /^\[mcps\./);

	if (existingMcpIndex !== -1) {
		// Find the end of all mcp sections
		let lastMcpEnd = existingMcpIndex;
		for (let i = existingMcpIndex; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) continue;
			const trimmed = line.trim();
			if (/^\[mcps\./.test(trimmed)) {
				lastMcpEnd = findSectionEnd(lines, i);
			} else if (/^\[(?!mcps\.)/.test(trimmed) && !trimmed.startsWith("#")) {
				break;
			}
		}
		// Insert after the last mcp section
		lines.splice(lastMcpEnd, 0, "", ...mcpLines);
	} else {
		// No mcp sections exist, add after profiles or at end
		const profilesIndex = findSection(lines, /^\[profiles\./);
		if (profilesIndex !== -1) {
			// Insert before profiles
			lines.splice(profilesIndex, 0, ...mcpLines, "");
		} else {
			// Just append at end
			lines.push("", ...mcpLines);
		}
	}

	content = lines.join("\n");
	await writeConfigFile(content);
}

/**
 * Add a capability to a profile's capabilities array
 */
export async function patchAddToProfile(
	profileName: string,
	capabilityName: string,
): Promise<void> {
	let content = await readConfigFile();
	const lines = content.split("\n");

	// Find the profile section
	const profilePattern = new RegExp(`^\\[profiles\\.${escapeRegExp(profileName)}\\]$`);
	const profileIndex = findSection(lines, profilePattern);

	if (profileIndex !== -1) {
		// Profile exists, find and modify capabilities line
		const profileEnd = findSectionEnd(lines, profileIndex);

		let capabilitiesLineIndex = -1;
		for (let i = profileIndex + 1; i < profileEnd; i++) {
			const line = lines[i];
			if (line === undefined) continue;
			const trimmed = line.trim();
			if (trimmed.startsWith("capabilities")) {
				capabilitiesLineIndex = i;
				break;
			}
		}

		if (capabilitiesLineIndex !== -1) {
			// Parse and modify the existing capabilities array
			const line = lines[capabilitiesLineIndex];
			if (line !== undefined) {
				const match = line.match(/capabilities\s*=\s*\[(.*)\]/);
				if (match && match[1] !== undefined) {
					const existingCaps = match[1]
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);

					// Check if capability already exists
					const quotedCap = `"${capabilityName}"`;
					if (!existingCaps.includes(quotedCap)) {
						existingCaps.push(quotedCap);
						const indent = line.match(/^(\s*)/)?.[1] ?? "";
						lines[capabilitiesLineIndex] = `${indent}capabilities = [${existingCaps.join(", ")}]`;
					}
				}
			}
		} else {
			// No capabilities line, add one after profile header
			lines.splice(profileIndex + 1, 0, `capabilities = ["${capabilityName}"]`);
		}
	} else {
		// Profile doesn't exist, create it
		// Find where to insert (after other profiles or at end)
		const anyProfileIndex = findSection(lines, /^\[profiles\./);

		if (anyProfileIndex !== -1) {
			// Find end of all profiles sections
			let lastProfileEnd = anyProfileIndex;
			for (let i = anyProfileIndex; i < lines.length; i++) {
				const line = lines[i];
				if (line === undefined) continue;
				const trimmed = line.trim();
				if (/^\[profiles\./.test(trimmed)) {
					lastProfileEnd = findSectionEnd(lines, i);
				} else if (/^\[(?!profiles\.)/.test(trimmed) && !trimmed.startsWith("#")) {
					break;
				}
			}
			// Insert after the last profile
			lines.splice(
				lastProfileEnd,
				0,
				"",
				`[profiles.${profileName}]`,
				`capabilities = ["${capabilityName}"]`,
			);
		} else {
			// No profiles at all, add at end
			lines.push("", `[profiles.${profileName}]`, `capabilities = ["${capabilityName}"]`);
		}
	}

	content = lines.join("\n");
	await writeConfigFile(content);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
