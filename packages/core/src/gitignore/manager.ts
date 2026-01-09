import { existsSync } from "node:fs";

const GITIGNORE_PATH = ".omni/.gitignore";

/**
 * Base gitignore patterns that are always present
 */
function getBaseGitignore(): string {
	return `# OmniDev working files - always ignored
# These files change frequently and are machine-specific

# Secrets
.env

# Generated content (rebuilt on sync)
generated/

# Runtime state
state/

# Sandbox execution
sandbox/

# Logs
*.log

# ============================================
# Capability-specific patterns (auto-managed)
# ============================================
`;
}

/**
 * Read the current .omni/.gitignore file
 * @returns Current gitignore content or base content if file doesn't exist
 */
export async function readGitignore(): Promise<string> {
	if (!existsSync(GITIGNORE_PATH)) {
		return getBaseGitignore();
	}
	return Bun.file(GITIGNORE_PATH).text();
}

/**
 * Write content to .omni/.gitignore
 * @param content - Content to write
 */
export async function writeGitignore(content: string): Promise<void> {
	await Bun.write(GITIGNORE_PATH, content);
}

/**
 * Parse gitignore content and extract capability sections
 * @param content - The gitignore file content
 * @returns Map of capability names to their patterns
 */
export function parseCapabilitySections(content: string): Map<string, string[]> {
	const sections = new Map<string, string[]>();
	const lines = content.split("\n");

	let currentCapability: string | null = null;
	const patterns: string[] = [];

	for (const line of lines) {
		// Check for capability header (e.g., "# tasks capability")
		const headerMatch = line.match(/^# (\S+) capability$/);
		if (headerMatch?.[1]) {
			// Save previous capability if exists
			if (currentCapability !== null) {
				sections.set(currentCapability, [...patterns]);
				patterns.length = 0;
			}
			currentCapability = headerMatch[1];
			continue;
		}

		// If we're in a capability section, collect patterns
		if (currentCapability !== null) {
			// Stop at the next comment or empty line after patterns
			if (line.trim() === "" || (line.startsWith("#") && !line.match(/^# \S+ capability$/))) {
				// Only save if we have patterns
				if (patterns.length > 0) {
					sections.set(currentCapability, [...patterns]);
				}
				patterns.length = 0;
				currentCapability = null;
				continue;
			}

			// Add pattern if it's not a comment
			if (line.trim() !== "" && !line.startsWith("#")) {
				patterns.push(line);
			}
		}
	}

	// Save last capability if exists
	if (currentCapability !== null && patterns.length > 0) {
		sections.set(currentCapability, patterns);
	}

	return sections;
}

/**
 * Build gitignore content from base + capability sections
 * @param capabilitySections - Map of capability names to their patterns
 * @returns Full gitignore content
 */
export function buildGitignoreContent(capabilitySections: Map<string, string[]>): string {
	let content = getBaseGitignore();

	// Add each capability section
	for (const [capability, patterns] of capabilitySections) {
		if (patterns.length > 0) {
			content += `\n# ${capability} capability\n`;
			for (const pattern of patterns) {
				content += `${pattern}\n`;
			}
		}
	}

	return content;
}

/**
 * Add gitignore patterns for a capability
 * @param capabilityId - The capability ID
 * @param patterns - Array of gitignore patterns
 */
export async function addCapabilityPatterns(
	capabilityId: string,
	patterns: string[],
): Promise<void> {
	const content = await readGitignore();
	const sections = parseCapabilitySections(content);

	// Add or update the capability section
	sections.set(capabilityId, patterns);

	const newContent = buildGitignoreContent(sections);
	await writeGitignore(newContent);
}

/**
 * Remove gitignore patterns for a capability
 * @param capabilityId - The capability ID
 */
export async function removeCapabilityPatterns(capabilityId: string): Promise<void> {
	const content = await readGitignore();
	const sections = parseCapabilitySections(content);

	// Remove the capability section
	sections.delete(capabilityId);

	const newContent = buildGitignoreContent(sections);
	await writeGitignore(newContent);
}

/**
 * Rebuild the entire .omni/.gitignore from enabled capabilities
 * @param enabledCapabilities - Map of enabled capability IDs to their gitignore patterns
 */
export async function rebuildGitignore(enabledCapabilities: Map<string, string[]>): Promise<void> {
	const newContent = buildGitignoreContent(enabledCapabilities);
	await writeGitignore(newContent);
}
