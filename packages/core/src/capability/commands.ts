import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Command } from "../types";
import { parseFrontmatterWithMarkdown } from "./yaml-parser";

interface CommandFrontmatter {
	name?: string;
	description: string;
	allowedTools?: string;
}

/**
 * Load commands from a capability directory.
 * Checks multiple directory names: "commands", "command"
 * Supports two formats:
 * 1. Subdirectory format: <dir>/<name>/COMMAND.md
 * 2. Flat file format: <dir>/<name>.md (for wrapped capabilities)
 */
export async function loadCommands(
	capabilityPath: string,
	capabilityId: string,
): Promise<Command[]> {
	const commands: Command[] = [];
	const possibleDirNames = ["commands", "command"];

	for (const dirName of possibleDirNames) {
		const dir = join(capabilityPath, dirName);

		if (!existsSync(dir)) {
			continue;
		}

		const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		for (const entry of entries) {
			if (entry.isDirectory()) {
				// Subdirectory format: <dir>/<name>/COMMAND.md
				const commandPath = join(dir, entry.name, "COMMAND.md");
				if (existsSync(commandPath)) {
					const command = await parseCommandFile(commandPath, capabilityId);
					commands.push(command);
				}
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				// Flat file format: <dir>/<name>.md (for wrapped capabilities)
				const commandPath = join(dir, entry.name);
				const command = await parseCommandFile(commandPath, capabilityId);
				commands.push(command);
			}
		}
	}

	return commands;
}

async function parseCommandFile(filePath: string, capabilityId: string): Promise<Command> {
	const content = await readFile(filePath, "utf-8");
	const parsed = parseFrontmatterWithMarkdown<CommandFrontmatter>(content);

	if (!parsed) {
		throw new Error(`Invalid COMMAND.md format at ${filePath}: missing YAML frontmatter`);
	}

	const frontmatter = parsed.frontmatter;
	const prompt = parsed.markdown;

	// Infer name from filename if not provided in frontmatter
	const inferredName = basename(filePath, ".md").replace(/^COMMAND$/i, "");
	const name = frontmatter.name || inferredName;

	if (!name || !frontmatter.description) {
		throw new Error(`Invalid COMMAND.md at ${filePath}: name and description required`);
	}

	const result: Command = {
		name,
		description: frontmatter.description,
		prompt: prompt.trim(),
		capabilityId,
	};

	// Add optional fields if present
	if (frontmatter.allowedTools) {
		result.allowedTools = frontmatter.allowedTools;
	}

	return result;
}
