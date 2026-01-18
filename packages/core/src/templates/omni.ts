/**
 * Template for OMNI.md - the user's project instructions file.
 * This is the single source of truth that gets transformed into
 * provider-specific files (CLAUDE.md, AGENTS.md, etc.) during sync.
 */
export function generateOmniMdTemplate(): string {
	return `# Project Instructions

<!-- This file is your project's instruction manifest for AI agents. -->
<!-- It will be combined with capability-generated content during sync. -->

## Project Description

<!-- TODO: Add 2-3 sentences describing your project -->
[Describe what this project does and its main purpose]

## Conventions

<!-- Add your project conventions, coding standards, and guidelines here -->

## Architecture

<!-- Describe your project's architecture and key components -->
`;
}
