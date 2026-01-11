import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { Doc, Rule } from "../types";

/**
 * Load rules from a capability's rules/ directory
 * @param capabilityPath Path to the capability directory
 * @param capabilityId ID of the capability
 * @returns Array of Rule objects
 */
export async function loadRules(capabilityPath: string, capabilityId: string): Promise<Rule[]> {
	const rulesDir = join(capabilityPath, "rules");

	if (!existsSync(rulesDir)) {
		return [];
	}

	const rules: Rule[] = [];
	const entries = readdirSync(rulesDir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			const rulePath = join(rulesDir, entry.name);
			const content = await Bun.file(rulePath).text();

			rules.push({
				name: basename(entry.name, ".md"),
				content: content.trim(),
				capabilityId,
			});
		}
	}

	return rules;
}

/**
 * Write aggregated rules and docs to .omni/instructions.md
 * Updates the generated section between markers while preserving user content
 * @param rules Array of rules from all enabled capabilities
 * @param docs Array of docs from all enabled capabilities
 */
export async function writeRules(rules: Rule[], docs: Doc[] = []): Promise<void> {
	const instructionsPath = ".omni/instructions.md";

	// Generate content from rules and docs
	const rulesContent = generateRulesContent(rules, docs);

	// Read existing content or create new file
	let content: string;
	if (existsSync(instructionsPath)) {
		content = await Bun.file(instructionsPath).text();
	} else {
		// Create new file with basic template
		content = `# OmniDev Instructions

## Project Description
<!-- TODO: Add 2-3 sentences describing your project -->
[Describe what this project does and its main purpose]

<!-- BEGIN OMNIDEV GENERATED CONTENT - DO NOT EDIT BELOW THIS LINE -->
<!-- END OMNIDEV GENERATED CONTENT -->
`;
	}

	// Replace content between markers
	const beginMarker = "<!-- BEGIN OMNIDEV GENERATED CONTENT - DO NOT EDIT BELOW THIS LINE -->";
	const endMarker = "<!-- END OMNIDEV GENERATED CONTENT -->";

	const beginIndex = content.indexOf(beginMarker);
	const endIndex = content.indexOf(endMarker);

	if (beginIndex === -1 || endIndex === -1) {
		// Markers not found, append to end
		content += `\n\n${beginMarker}\n${rulesContent}\n${endMarker}\n`;
	} else {
		// Replace content between markers
		content =
			content.substring(0, beginIndex + beginMarker.length) +
			"\n" +
			rulesContent +
			"\n" +
			content.substring(endIndex);
	}

	await Bun.write(instructionsPath, content);
}

function generateRulesContent(rules: Rule[], docs: Doc[] = []): string {
	if (rules.length === 0 && docs.length === 0) {
		return `<!-- This section is automatically updated when capabilities change -->

## Capabilities

No capabilities enabled yet. Run \`omnidev capability enable <name>\` to enable capabilities.`;
	}

	let content = `<!-- This section is automatically updated when capabilities change -->

## Capabilities

`;

	// Add documentation section if there are docs
	if (docs.length > 0) {
		content += `### Documentation

`;
		for (const doc of docs) {
			content += `#### ${doc.name} (from ${doc.capabilityId})

${doc.content}

`;
		}
	}

	// Add rules section if there are rules
	if (rules.length > 0) {
		content += `### Rules

`;
		for (const rule of rules) {
			content += `#### ${rule.name} (from ${rule.capabilityId})

${rule.content}

`;
		}
	}

	return content.trim();
}
