/**
 * Capability Export Types
 *
 * These types define the structure that capabilities use to export their features.
 * Capabilities should import these types from @omnidev-ai/capability and use them
 * in their index.ts default export.
 */

import type { CapabilityCommand, CapabilityRouteMap } from "./cli.js";

/**
 * File content structure for programmatic file creation.
 */
export interface FileContent {
	/** File name (relative path within capability) */
	name: string;

	/** File content */
	content: string;
}

/**
 * Documentation export structure.
 */
export interface DocExport {
	/** Document title */
	title: string;

	/** Markdown content */
	content: string;
}

/**
 * Skill export structure.
 */
export interface SkillExport {
	/** SKILL.md content (markdown with YAML frontmatter) */
	skillMd: string;

	/** Optional: Reference files to create (files the skill needs access to) */
	references?: FileContent[];

	/** Optional: Additional files to create (templates, examples, etc.) */
	additionalFiles?: FileContent[];
}

/**
 * Subagent export structure.
 *
 * Defines a subagent that Claude can delegate tasks to.
 * Uses YAML frontmatter in markdown format for configuration.
 *
 * @example
 * ```typescript
 * const codeReviewer: SubagentExport = {
 *   subagentMd: `---
 * name: code-reviewer
 * description: Reviews code for quality and best practices
 * tools: Read, Glob, Grep
 * model: sonnet
 * ---
 *
 * You are a code reviewer. When invoked, analyze the code and provide
 * specific, actionable feedback on quality, security, and best practices.`
 * };
 * ```
 */
export interface SubagentExport {
	/** SUBAGENT.md content (markdown with YAML frontmatter) */
	subagentMd: string;
}

/**
 * Slash command export structure.
 *
 * Defines a slash command that can be invoked in Claude Code.
 * Uses YAML frontmatter in markdown format for configuration.
 *
 * @example
 * ```typescript
 * const fixIssue: CommandExport = {
 *   commandMd: `---
 * name: fix-issue
 * description: Fix a GitHub issue following coding standards
 * allowed-tools: Bash(git add:*), Bash(git commit:*)
 * ---
 *
 * Fix issue #$ARGUMENTS following our coding standards.
 *
 * 1. Read the issue details
 * 2. Implement the fix
 * 3. Write tests
 * 4. Create a commit`
 * };
 * ```
 */
export interface CommandExport {
	/** COMMAND.md content (markdown with YAML frontmatter) */
	commandMd: string;
}

/**
 * Complete capability export structure.
 *
 * Capabilities export this as their default export from index.ts.
 * All content fields are OPTIONAL and PROGRAMMATIC.
 * Capabilities can also provide content via static files in their directory.
 * Both approaches are supported and will be merged during sync.
 *
 * @example
 * ```typescript
 * // Static files approach - just export CLI commands
 * export default {
 *   cliCommands: { mycap: myRoutes },
 *   gitignore: ["mycap/"],
 *   sync
 * } satisfies CapabilityExport;
 * ```
 *
 * @example
 * ```typescript
 * // Programmatic approach - generate content dynamically
 * export default {
 *   cliCommands: { mycap: myRoutes },
 *   docs: [{ title: "Guide", content: "# Guide\n..." }],
 *   rules: ["# Rule content..."],
 *   skills: [{ skillMd: "...", references: [...] }],
 *   gitignore: ["mycap/"],
 *   sync
 * } satisfies CapabilityExport;
 * ```
 */
export interface CapabilityExport {
	/** CLI commands provided by this capability */
	cliCommands?: Record<string, CapabilityCommand | CapabilityRouteMap>;

	/** Documentation (programmatic - optional, can also use docs/ directory) */
	docs?: DocExport[];

	/** Rules (programmatic - optional, can also use rules/ directory) */
	rules?: string[]; // Array of markdown content strings

	/** Skills (programmatic - optional, can also use skills/ directory) */
	skills?: SkillExport[];

	/** Subagents (programmatic - optional, can also use subagents/ directory) */
	subagents?: SubagentExport[];

	/** Commands (programmatic - optional, can also use commands/ directory) */
	commands?: CommandExport[];

	/** Gitignore patterns */
	gitignore?: string[];

	/** Custom sync hook function */
	sync?: () => Promise<void>;

	/** Additional exports for extensibility */
	[key: string]: unknown;
}
