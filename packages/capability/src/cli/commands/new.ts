/**
 * capability new command
 *
 * Creates a new capability with template files.
 */

import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface NewCommandOptions {
	path?: string | undefined;
	programmatic?: boolean | undefined;
}

/**
 * Validate capability ID format.
 * Must be lowercase, start with a letter, and use kebab-case.
 */
export function isValidCapabilityId(id: string): boolean {
	return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id);
}

/**
 * Convert kebab-case to Title Case.
 */
function toTitleCase(kebabCase: string): string {
	return kebabCase
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Generate a capability.toml file for a new capability.
 */
function generateCapabilityToml(id: string, name: string): string {
	const description = "TODO: Add a description for your capability";
	return `[capability]
id = "${id}"
name = "${name}"
version = "0.1.0"
description = "${description}"

# Optional author information
# [capability.author]
# name = "Your Name"
# email = "you@example.com"

# Optional metadata
# [capability.metadata]
# repository = "https://github.com/user/repo"
# license = "MIT"
`;
}

/**
 * Generate a SKILL.md template file.
 */
function generateSkillTemplate(skillName: string): string {
	return `---
name: ${skillName}
description: TODO: Add a description for this skill
---

## What I do

<!-- Describe what this skill helps the AI agent accomplish -->
- TODO: List the main capabilities of this skill

## When to use me

<!-- Describe scenarios when this skill should be invoked -->
Use this skill when you need to:
- TODO: Add trigger conditions

## Implementation

<!-- Add detailed instructions for the AI agent -->
### Steps

1. TODO: Add implementation steps
2. Validate inputs and outputs
3. Report results to the user

## Examples

<!-- Optional: Add examples of how this skill should be used -->
\`\`\`
TODO: Add example usage
\`\`\`
`;
}

/**
 * Generate a rule markdown template file.
 */
function generateRuleTemplate(ruleName: string): string {
	const displayName = toTitleCase(ruleName);
	return `### ${displayName}

<!-- Rules are guidelines that the AI agent should follow when working in this project -->
<!-- Each rule should start with a ### header -->

TODO: Add specific guidelines the AI should follow. Be specific and actionable.
`;
}

/**
 * Generate a hooks.toml template file.
 */
function generateHooksTemplate(): string {
	return `# Hook configuration for this capability
# See: https://omnidev.dev/docs/advanced/hooks

# Example: Validate bash commands before execution
# [[PreToolUse]]
# matcher = "Bash"
# [[PreToolUse.hooks]]
# type = "command"
# command = "\${OMNIDEV_CAPABILITY_ROOT}/hooks/validate-bash.sh"
# timeout = 30

# Example: Run linter after file edits
# [[PostToolUse]]
# matcher = "Write|Edit"
# [[PostToolUse.hooks]]
# type = "command"
# command = "\${OMNIDEV_CAPABILITY_ROOT}/hooks/run-linter.sh"

# Example: Load context at session start
# [[SessionStart]]
# matcher = "startup|resume"
# [[SessionStart.hooks]]
# type = "command"
# command = "\${OMNIDEV_CAPABILITY_ROOT}/hooks/load-context.sh"
`;
}

/**
 * Generate a sample hook script.
 */
function generateHookScript(): string {
	return `#!/bin/bash
# Sample hook script
# This script receives JSON input via stdin

# Read JSON input from stdin
INPUT=$(cat)

# Example: Extract tool information
# TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
# COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Add your validation logic here
# Exit 0 to allow, exit 2 to block

exit 0
`;
}

/**
 * Generate package.json for programmatic capability.
 */
function generatePackageJson(id: string): string {
	const pkg = {
		name: `@capability/${id}`,
		version: "0.1.0",
		type: "module",
		main: "dist/index.js",
		scripts: {
			build: "npx @omnidev-ai/capability build",
			watch: "npx @omnidev-ai/capability build --watch",
		},
		dependencies: {
			"@omnidev-ai/capability": "latest",
		},
	};
	return JSON.stringify(pkg, null, "\t");
}

/**
 * Generate index.ts for programmatic capability.
 */
function generateIndexTs(id: string, name: string): string {
	const funcName = `run${id.replace(/-/g, "").replace(/^./, (c) => c.toUpperCase())}`;
	const varName = `${id.replace(/-/g, "")}Command`;

	return `/**
 * ${name} Capability
 *
 * A programmatic capability with CLI commands.
 */

import { command, type CapabilityExport } from "@omnidev-ai/capability";

// Example command implementation
async function ${funcName}(flags: { verbose?: boolean }): Promise<void> {
	console.log("Hello from ${name}!");
	console.log("");
	console.log("This is a programmatic capability.");
	console.log("Edit index.ts to customize this command.");

	if (flags.verbose) {
		console.log("");
		console.log("Verbose mode enabled.");
	}
}

// Build the main command
const ${varName} = command({
	brief: "${name} command",
	parameters: {
		flags: {
			verbose: {
				brief: "Show verbose output",
				kind: "boolean",
				optional: true,
			},
		},
	},
	func: ${funcName},
});

// Default export: Structured capability export
export default {
	cliCommands: {
		"${id}": ${varName},
	},
} satisfies CapabilityExport;
`;
}

/**
 * Generate .gitignore for programmatic capability.
 */
function generateGitignore(): string {
	return `dist/
node_modules/
`;
}

/**
 * Run the capability new command to bootstrap a new capability.
 */
export async function runNew(capabilityId: string, options: NewCommandOptions): Promise<void> {
	// Validate capability ID
	if (!isValidCapabilityId(capabilityId)) {
		console.error(`Error: Invalid capability ID: '${capabilityId}'`);
		console.log("");
		console.log("  ID must be lowercase, start with a letter, and use kebab-case");
		console.log("  Example: my-capability, tasks, api-client");
		process.exit(1);
	}

	const id = capabilityId;

	// Determine output path
	let capabilityDir: string;

	if (options.path) {
		capabilityDir = options.path;
	} else {
		// Default path
		capabilityDir = `capabilities/${id}`;
	}

	// Check if capability already exists at that path
	if (existsSync(capabilityDir)) {
		console.error(`Error: Directory already exists at ${capabilityDir}`);
		process.exit(1);
	}

	// Derive name from ID
	const name = toTitleCase(id);

	// Create directory structure
	mkdirSync(capabilityDir, { recursive: true });

	// Write capability.toml
	const capabilityToml = generateCapabilityToml(id, name);
	await writeFile(join(capabilityDir, "capability.toml"), capabilityToml, "utf-8");

	// Create skill template
	const skillDir = join(capabilityDir, "skills", "getting-started");
	mkdirSync(skillDir, { recursive: true });
	await writeFile(join(skillDir, "SKILL.md"), generateSkillTemplate("getting-started"), "utf-8");

	// Create rule template
	const rulesDir = join(capabilityDir, "rules");
	mkdirSync(rulesDir, { recursive: true });
	await writeFile(
		join(rulesDir, "coding-standards.md"),
		generateRuleTemplate("coding-standards"),
		"utf-8",
	);

	// Create hooks template
	const hooksDir = join(capabilityDir, "hooks");
	mkdirSync(hooksDir, { recursive: true });
	await writeFile(join(hooksDir, "hooks.toml"), generateHooksTemplate(), "utf-8");
	await writeFile(join(hooksDir, "example-hook.sh"), generateHookScript(), "utf-8");

	// Create programmatic files if --programmatic flag is set
	if (options.programmatic) {
		await writeFile(join(capabilityDir, "package.json"), generatePackageJson(id), "utf-8");
		await writeFile(join(capabilityDir, "index.ts"), generateIndexTs(id, name), "utf-8");
		await writeFile(join(capabilityDir, ".gitignore"), generateGitignore(), "utf-8");
	}

	console.log(`Created capability: ${name}`);
	console.log(`  Location: ${capabilityDir}`);
	console.log("");
	console.log("  Files created:");
	console.log("    - capability.toml");
	console.log("    - skills/getting-started/SKILL.md");
	console.log("    - rules/coding-standards.md");
	console.log("    - hooks/hooks.toml");
	console.log("    - hooks/example-hook.sh");
	if (options.programmatic) {
		console.log("    - package.json");
		console.log("    - index.ts");
		console.log("    - .gitignore");
	}
	console.log("");
	if (options.programmatic) {
		console.log("To build and use this capability:");
		console.log(`   cd ${capabilityDir}`);
		console.log("   npm install && npm run build");
		console.log(`   cd -`);
		console.log(`   omnidev add cap --local ./${capabilityDir}`);
	} else {
		console.log("To add this capability as a local source, run:");
		console.log(`   omnidev add cap --local ./${capabilityDir}`);
	}
}
