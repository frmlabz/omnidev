/**
 * Templates for bootstrapping new capabilities.
 */

export interface CapabilityTemplateOptions {
	id: string;
	name: string;
	description?: string;
}

/**
 * Escape a string for use as a TOML basic string value.
 * Escapes backslashes, double quotes, and control characters.
 */
function escapeTomlString(value: string): string {
	return value
		.replace(/\\/g, "\\\\") // Escape backslashes first
		.replace(/"/g, '\\"') // Escape double quotes
		.replace(/\n/g, "\\n") // Escape newlines
		.replace(/\r/g, "\\r") // Escape carriage returns
		.replace(/\t/g, "\\t"); // Escape tabs
}

/**
 * Generate a capability.toml file for a new capability.
 */
export function generateCapabilityToml(options: CapabilityTemplateOptions): string {
	const description = options.description || "TODO: Add a description for your capability";
	return `[capability]
id = "${escapeTomlString(options.id)}"
name = "${escapeTomlString(options.name)}"
version = "0.1.0"
description = "${escapeTomlString(description)}"

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
export function generateSkillTemplate(skillName: string): string {
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
 * Rules should start with a ### header and contain guidelines for AI agents.
 */
export function generateRuleTemplate(ruleName: string): string {
	return `### ${formatDisplayName(ruleName)}

<!-- Rules are guidelines that the AI agent should follow when working in this project -->
<!-- Each rule should start with a ### header -->

TODO: Add specific guidelines the AI should follow. Be specific and actionable.
`;
}

/**
 * Generate a hooks.toml template file.
 */
export function generateHooksTemplate(): string {
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
export function generateHookScript(): string {
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
 * Convert kebab-case to Title Case for display.
 */
function formatDisplayName(kebabCase: string): string {
	return kebabCase
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}
