/**
 * Template for .claude/claude.md (Claude provider)
 */
export function generateClaudeTemplate(): string {
	return `# Project Instructions

## Project Description
<!-- TODO: Add 2-3 sentences describing your project -->
[Describe what this project does and its main purpose]

## Capabilities

This project uses OmniDev for capability management. See the rules below for available capabilities.

@import .omni/generated/rules.md
`;
}

/**
 * OmniDev section to append to existing claude.md
 */
export function generateClaudeAppendSection(): string {
	return `

---

# OmniDev Configuration

## Project Description
<!-- TODO: Add 2-3 sentences describing your project -->
[Describe what this project does and its main purpose]

## Capabilities

This project uses OmniDev for capability management. See the rules below for available capabilities.

@import .omni/generated/rules.md
`;
}
