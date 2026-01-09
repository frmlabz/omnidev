/**
 * Template for AGENTS.md (Codex provider)
 */
export function generateAgentsTemplate(): string {
	return `# Project Instructions

## Project Description
<!-- TODO: Add 2-3 sentences describing your project -->
[Describe what this project does and its main purpose]

## Capabilities

This project uses OmniDev for capability management. See the rules below for available capabilities.

@import .omni/generated/rules.md
`;
}
