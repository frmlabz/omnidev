/**
 * YAML Frontmatter Parser Utility
 *
 * Consolidates YAML frontmatter parsing logic that was duplicated across
 * skills.ts, commands.ts, and subagents.ts.
 *
 * This utility provides:
 * - parseSimpleYamlFrontmatter: Parse key: value pairs from YAML
 * - parseFrontmatterWithMarkdown: Extract frontmatter + markdown content
 */

/** Matches a block scalar header: `|`, `>`, with optional chomping and indent indicators. */
const BLOCK_SCALAR_HEADER = /^([|>])([-+]?)\d*$/;

/**
 * Join the raw lines of a block scalar into its string value.
 *
 * Strips the block's common indentation, then either preserves newlines
 * (literal, `|`) or folds them into spaces with blank lines as breaks
 * (folded, `>`).
 */
function joinBlockScalar(rawLines: string[], folded: boolean, keepTrailing: boolean): string {
	const indents = rawLines
		.filter((line) => line.trim() !== "")
		.map((line) => line.match(/^\s*/)?.[0].length ?? 0);
	const indent = indents.length > 0 ? Math.min(...indents) : 0;

	const lines = rawLines.map((line) => (line.trim() === "" ? "" : line.slice(indent)));

	// Default and "-" chomping both drop trailing blank lines; only "+" keeps them.
	if (!keepTrailing) {
		while (lines.length > 0 && lines[lines.length - 1] === "") {
			lines.pop();
		}
	}

	if (!folded) {
		return lines.join("\n");
	}

	let result = "";
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? "";
		if (line === "") {
			result += "\n";
			continue;
		}
		if (index > 0 && lines[index - 1] !== "") {
			result += " ";
		}
		result += line;
	}
	return result;
}

/**
 * Parse simple YAML key: value pairs
 * Supports basic key: value syntax (not full YAML spec)
 * Handles quoted values and block scalars (`key: |` / `key: >`)
 *
 * @param yaml - YAML content string to parse
 * @returns Record of key-value pairs
 */
export function parseSimpleYamlFrontmatter<T>(yaml: string): T {
	const result: Record<string, string> = {};
	const lines = yaml.split("\n");

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? "";
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		// Only unindented lines declare keys. Indented lines belong to the value
		// above them, so a wrapped description containing "Use when: ..." never
		// gets mistaken for a key of its own.
		if (/^\s/.test(line)) {
			continue;
		}

		const colonIndex = trimmed.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}

		const rawKey = trimmed.slice(0, colonIndex).trim();
		let value = trimmed.slice(colonIndex + 1).trim();

		const blockScalar = value.match(BLOCK_SCALAR_HEADER);
		if (blockScalar) {
			const blockLines: string[] = [];
			let cursor = index + 1;
			for (; cursor < lines.length; cursor++) {
				const next = lines[cursor] ?? "";
				if (next.trim() === "") {
					blockLines.push("");
					continue;
				}
				// The block ends at the first line back at the key's indentation.
				if (!/^\s/.test(next)) {
					break;
				}
				blockLines.push(next);
			}
			index = cursor - 1;
			value = joinBlockScalar(blockLines, blockScalar[1] === ">", blockScalar[2] === "+");
		} else if (
			value.length >= 2 &&
			((value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'")))
		) {
			// Remove quotes if present (double or single)
			value = value.slice(1, -1);
		}

		// Convert kebab-case to camelCase
		const key = rawKey.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

		result[key] = value;
	}

	return result as unknown as T;
}

/**
 * Parse content with YAML frontmatter separated from markdown
 * Expected format:
 * ```
 * ---
 * key: value
 * ---
 * Markdown content here
 * ```
 *
 * @param content - Full content with frontmatter and markdown
 * @returns Object with frontmatter (parsed) and markdown (remaining) or null if no frontmatter
 */
export function parseFrontmatterWithMarkdown<T>(
	content: string,
): { frontmatter: T; markdown: string } | null {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/s);

	if (!match?.[1] || match[2] === undefined) {
		return null;
	}

	const frontmatter = parseSimpleYamlFrontmatter<T>(match[1]);
	const markdown = match[2];

	return { frontmatter, markdown };
}
