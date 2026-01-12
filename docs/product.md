# OmniDev Product Specification

> **Status**: MVP Draft v0.8
> **Last Updated**: 2026-01-09

## Vision

OmniDev is a meta-MCP that eliminates context bloat by exposing only **2 tools** to the LLM while providing access to unlimited power through a sandboxed coding environment. **Capabilities** are the fundamental building blocks—plugins that add MCPs, custom functionality, documentation, CLI commands, TUI views, or workflows—all exposed as callable functions in the sandbox.

**The Core Insight**: Most agents use MCP by directly exposing "tools" to the LLM. We do something different: we convert MCP tools (and everything else) into a **programmable API** (TypeScript), and ask the LLM to write code that calls that API.

> *Reference: Inspired by Cloudflare's "Code Mode". LLMs are often better at writing code to call tools than calling tools directly. This approach allows stringing together multiple calls, looping, and logic without round-trips.*

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [The Two MCP Tools](#the-two-mcp-tools)
5. [Capabilities System](#capabilities-system)
6. [Capability Sources & Versioning](#capability-sources--versioning)
7. [Dependency Management & Workspaces](#dependency-management--workspaces)
8. [Environment & Secrets](#environment--secrets)
9. [Skills & Rules System](#skills--rules-system)
10. [Agent Sync & Multi-Provider Support](#agent-sync--multi-provider-support)
11. [Sandbox Environment](#sandbox-environment)
12. [Git Safety Layer](#git-safety-layer)
13. [Directory Structure](#directory-structure)
14. [Configuration System](#configuration-system)
15. [Profiles System](#profiles-system)
16. [Ralph - AI Agent Orchestrator](#ralph---ai-agent-orchestrator)
17. [CLI Interface](#cli-interface)
18. [Demo Scenarios](#demo-scenarios)
19. [Technical Notes](#technical-notes)
20. [Future Features](#future-features)

---

## Core Concepts

### The Problem

1.  **Context Bloat**: Loading 10 MCPs = 100+ tool definitions in context.
2.  **Inefficient Execution**: Traditional agents need a round-trip for every tool call.
3.  **Rigid Tooling**: Tools are static; they don't adapt to project phases (planning vs. coding).
4.  **Unsafe File Access**: LLMs can make destructive changes without safety nets.

### The Solution: "Everything is a Capability"

OmniDev wraps every piece of functionality into a **Capability**.

*   **MCPs → Code**: An AWS MCP becomes `aws.*` functions in the sandbox.
*   **Workflows → Code**: PRD management becomes `ralph.*` functions.
*   **Docs → Code**: Guidelines become searchable/readable context.
*   **CLI Extensions → Code**: Capabilities can add commands and TUI views to the CLI.

The LLM interacts with the world via **Code**, not JSON tool calls.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Traditional MCP Approach                    │
│                                                                  │
│   LLM Context: [tool1, tool2, tool3, ... tool50]                │
│                        ↓                                         │
│   Action: Call tool1 → Wait → Result → Call tool2 → Wait...     │
│                                                                  │
│                  SLOW, BLOATED, FRAGILE                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      OmniDev Approach                            │
│                                                                  │
│   LLM Context: [omni_query, omni_execute]                       │
│                        ↓                                         │
│   Action: Write Script                                          │
│           ├── const result1 = await tool1()                     │
│           ├── if (result1) await tool2(result1)                 │
│           └── return finalResult                                │
│                                                                  │
│                  FAST, PROGRAMMATIC, POWERFUL                   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Requirements Summary

1.  **Flexible Orchestration**: Ralph is the built-in AI orchestrator. Users can swap or extend it with custom capabilities.
2.  **Doc-Driven Development**: Capabilities can ingest documentation (e.g., "Code Guidelines") and expose them to the LLM to enforce standards.
3.  **MCP-to-Code Conversion**: Any MCP server is automatically converted into a sandboxed library (`server.action()`).
4.  **Layered Configuration**: Supports teams. A team lead shares a minimal config (repo access, linting rules), and individual developers layer their own tools (debugging, personal notes) on top.
5.  **Extensible CLI & TUI**: Capabilities can contribute CLI commands and OpenTUI views, making the CLI itself extensible.

### Naming & Paths

OmniDev uses a **split directory strategy** to separate visible, committed project code from hidden local state:

| Path | Visibility | Git Status | Contents |
|------|------------|------------|----------|
| **`omni/`** | Visible | **Committed** | Capabilities, shared config, project-specific logic |
| **`.omni/`** | Hidden | **Gitignored** | Local state, sandbox scratch, caches, secrets |
| **`~/.omni/`** | Hidden | N/A | User-global config, personal capabilities |

**Why the split?**
*   Using only `.omni/` (hidden) suggests "metadata/cache" (like `.git` or `.next`). If capabilities contain project-specific business logic (custom deployment scripts, database migration tools), hiding them is dangerous—developers will ignore them.
*   The visible `omni/` directory makes capabilities **first-class citizens** in the codebase, encouraging code review and collaboration.

**Path constants:**
*   **`OMNI_PROJECT`**: Visible project directory (default: `omni/` at repo root). Contains capabilities, shared config.
*   **`OMNI_LOCAL`**: Hidden local directory (default: `.omni/` at repo root). Contains state, sandbox, caches.
*   **`OMNI_HOME`**: User-global directory (default: `~/.omni/`). Personal capabilities, global config.

---

## Technology Stack

OmniDev is built entirely in **TypeScript**, running on **Bun** for maximum performance and simplicity.

| Component | Technology |
|-----------|------------|
| **Runtime** | [Bun](https://bun.sh) – Fast JavaScript runtime with native TypeScript support |
| **CLI Framework** | [Stricli](https://bloomberg.github.io/stricli/) – Zero-dependency, type-safe CLI framework |
| **TUI Framework** | [OpenTUI](https://github.com/anomalyco/opentui) – Terminal UI with React reconciler |
| **MCP Server** | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) – Official TypeScript MCP SDK |
| **Sandbox Runtime** | Bun (TypeScript execution) |
| **Configuration** | TOML (parsed with `@std/toml` or similar) |

### Why This Stack?

1.  **Single Language**: TypeScript everywhere—CLI, MCP, sandbox, capabilities. No context switching.
2.  **Dynamic Loading**: Capabilities are loaded at runtime via `import()`—no recompilation needed.
3.  **React for TUI**: OpenTUI uses React, so capability authors can use familiar patterns for building CLI views.
4.  **Type Safety**: Stricli provides compile-time safety for CLI commands; TypeScript provides it everywhere else.
5.  **Performance**: Bun is significantly faster than Node.js for both startup and execution.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM / AI Agent                           │
│                                                                  │
│   Only sees 2 tools:                                            │
│   • omni_query - Search capabilities & snippets                │
│   • omni_execute - Run code with full project access            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OmniDev Server                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Capabilities Registry                     │   │
│  │  • Directories in omni/capabilities/                     │   │
│  │  • Composed of code, docs, skills, CLI commands, views   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │             Execution Environment ("Sandbox")            │   │
│  │  • Runtime: Bun (TypeScript)                             │   │
│  │  • Modules: Auto-generated from active Capabilities      │   │
│  │  • Access: Read/Write to repo (default)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Git Safety Layer                        │   │
│  │  • Auto-commit / Rollback                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (Stricli)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Built-in Commands                       │   │
│  │  • omnidev init / serve / doctor                         │   │
│  │  • omnidev capability list / enable / disable            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Capability-Contributed Commands              │   │
│  │  • Dynamically loaded from active capabilities           │   │
│  │  • Can include OpenTUI views for rich terminal UIs       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Three MCP Tools

OmniDev exposes exactly **three** tools to the LLM. Everything else (MCP tools, workflows, docs) becomes code inside the execution environment.

### Tool 1: `omni_query`

Simple search across capabilities, docs, skills, and rules.

**Uses:**
*   Search across active capabilities, docs, skills, and rules without dumping full content
*   Return short snippets tagged by type (capability/doc/skill/rule)
*   If `query` is empty, return a compact summary of enabled capabilities

**Request shape:**

```json
{
  "query": "search query"
}
```

**Response shape:**

```text
Enabled capabilities (3):
  - tasks: Task management capability
  - context7: Query up-to-date library documentation
  - aws: AWS operations via MCP

Use omni_sandbox_environment to discover available tools.
```

Or when searching:

```text
[capability:tasks] Task management capability
[skill:tasks/task-workflow] Workflow for managing tasks
[doc:tasks/definition] Task management documentation...
```

### Tool 2: `omni_sandbox_environment`

Discover available sandbox tools with progressive detail levels.

**Uses:**
*   No params: Overview of all modules and their tools (short descriptions)
*   With `capability`: Details for that module (input/output schemas for each tool)
*   With `capability` + `tool`: Full specification (JSDoc, examples, JSON schema)

**Request shape:**

```json
{
  "capability": "tasks",
  "tool": "createTask"
}
```

**Response levels:**

**Level 1: Overview (no params)**
```markdown
# Sandbox Environment

Available modules: 2

## tasks
Task management capability

Tools:
  - createTask: Create a new task with title, description, tags, and priority
  - getTasks: Get all tasks with optional filtering
  - updateTask: Update a task's fields

## context7 [MCP]
Query up-to-date library documentation

Tools:
  - resolveLibraryId: Resolve library ID from name
  - getLibraryDocs: Get documentation for a library
```

**Level 2: Capability details**
```markdown
# Module: tasks

## Tools

### createTask
Create a new task with title, description, tags, and priority

**Input:**
{
  title: string;  // Task title (required)
  description?: string;  // Task description in markdown
  tags?: string[];  // Tags for categorization
  priority?: number;  // Priority level 1-5 (default: 3)
}

**Output:**
Task object with id, title, status, timestamps, etc.
```

**Level 3: Tool specification**
```markdown
# tasks.createTask

/**
 * Create a new task in the task management system.
 *
 * @param input.title - The title of the task (required)
 * @param input.description - Optional markdown description
 * @param input.tags - Optional array of tags
 * @param input.priority - Priority level 1-5 (default: 3)
 * @returns The created Task object with generated ID
 *
 * @example
 * const task = await createTask({
 *   title: "Fix login bug",
 *   priority: 5
 * });
 */

## JSON Schema (Input)
{
  "type": "object",
  "properties": {
    "title": { "type": "string", "description": "Task title (required)" },
    "priority": { "type": "number", "minimum": 1, "maximum": 5 }
  },
  "required": ["title"]
}
```

### Tool 3: `omni_execute`

Runs TypeScript code with the currently active capabilities available as importable modules.

**Request shape (MVP):**

```json
{
  "code": "full contents of main.ts"
}
```

**Code format (MVP):**

The LLM should write a complete TypeScript file that OmniDev can execute verbatim:

*   The input `code` is the full contents of `main.ts` (not a snippet).
*   Export a `main()` function that returns a number (0 on success).
*   Perform side-effectful work inside `main()` so it's easy to rerun and reason about.

```typescript
// Example sandbox script
import * as ralph from 'ralph';
import * as fs from 'fs';

export async function main(): Promise<number> {
  // Get next story to work on
  const story = await ralph.getNextStory("user-auth");
  
  if (!story) {
    console.log("All stories complete!");
    return 0;
  }
  
  // Read the spec file
  const spec = fs.readFileSync(story.specFile, "utf-8");
  console.log(`Working on: ${story.title}`);
  console.log(`Spec: ${spec}`);
  
  return 0; // Success
}
```

**Execution model (MVP):**

*   OmniDev writes the file to `.omni/sandbox/main.ts` and executes it with `bun run`.
*   The repo root is the working directory.
*   Active capability modules (from `capability.toml` `[exports].module`) are importable by name.

**Response shape (MVP):**

```json
{
  "exit_code": 0,
  "stdout": "...",
  "stderr": "",
  "changed_files": ["src/app.ts", "README.md"],
  "diff_stat": { "files": 2, "insertions": 10, "deletions": 3 }
}
```

---

## Capabilities System

### Structure of a Capability

A capability is not a rigid "type" but a **composition**. It is defined by a directory in `omni/capabilities/<name>/` containing these core files plus any combination of optional components:

```
omni/capabilities/my-capability/
├── capability.toml     # Capability Configuration (Required)
├── definition.md       # Base Docs & Description (Required)
├── index.ts            # Main exports (tools, CLI commands, views)
├── tools/              # Sandbox Code (TypeScript)
│   └── utils.ts        # TypeScript functions to inject
├── cli/                # CLI Extensions
│   ├── commands.ts     # Stricli command definitions
│   └── views/          # OpenTUI React components
│       └── StatusView.tsx
├── docs/               # Knowledge Base
│   ├── guidelines.md   # Text to be indexed
│   └── reference.pdf   # PDFs/other formats
├── rules/              # Guidelines & Constraints
│   └── code-quality.md # Simple markdown rules
├── skills/             # Agent Instructions
│   └── my-skill/
│       └── SKILL.md    # Agent Skill (YAML frontmatter + Markdown)
```

### Components Detail

1.  **`capability.toml` (Config)**
    *   The source of truth for capability configuration and metadata.
    *   Includes optional `[mcp]` configuration for running an external MCP server (command, args, env, etc.).
    *   **Supervisor Role**: OmniDev handles the lifecycle (start/stop) of configured MCP servers.
    *   **Wrapper**: OmniDev converts MCP tools into callable sandbox functions (e.g., `aws.s3ListBuckets()`).

2.  **`definition.md` (Docs)**
    *   Human-readable base documentation and description.
    *   Used as the default text shown in generic `omni_query` results.
    *   Not used for configuration (keep it as plain Markdown).

3.  **`index.ts` (Main Exports)**
    *   The primary entry point for the capability.
    *   Exports: `tools` (sandbox functions), `cliCommands`, `cliViews`.
    *   OmniDev dynamically imports this file to register the capability.

4.  **`tools/` (Sandbox Code)**
    *   Contains `.ts` files with functions exposed to the sandbox.
    *   These are imported by `index.ts` and re-exported under the capability namespace.
    *   **Export rule (MVP)**: Functions exported from `index.ts` become attributes on the capability module (e.g., `ralph.getPRD()`).

5.  **`cli/` (CLI Extensions)**
    *   `commands.ts`: Stricli command definitions that extend the CLI.
    *   `views/`: OpenTUI React components for rich terminal UIs.
    *   These are registered when the capability loads, adding commands like `omnidev ralph start`.

6.  **`docs/` (Knowledge)**
    *   Markdown or text files that provide context.
    *   Indexed by OmniDev for RAG-like querying via `omni_query`.
    *   Example: `code_style.md` tells the LLM how to write code in this project.
    *   **MVP convention**: Index `definition.md` plus all files in `docs/` by default.

7.  **`skills/` (Agent Skills)**
    *   Defines "skills" or "behaviors" for the agent in a standard, portable format.
    *   **MVP convention**: A skill is a directory `skills/<skill-name>/` containing `SKILL.md`.
    *   `SKILL.md` must contain YAML frontmatter with at least `name` and `description`, followed by Markdown instructions.
    *   The skill `name` must match the parent directory name.
    *   Skills are always included regardless of profile.
    *   **Naming constraints (Agent Skills spec)**:
        *   `name`: 1–64 chars, lowercase letters/numbers/hyphens, no leading/trailing hyphen, no consecutive hyphens.
        *   `description`: 1–1024 chars; describe what it does and when to use it.

8.  **`rules/` (Guidelines & Constraints)**
    *   Simple markdown files with guidelines, constraints, or policies.
    *   Stored in `rules/*.md` within the capability directory.
    *   Included in agent sync output when the capability is enabled.
    *   Great for code standards, review checklists, project constraints, etc.

### `capability.toml` (MVP Schema)

**Required:**
*   `[capability]`: `id`, `name`, `version`, `description`

**Common optional tables:**
*   `[exports]`: `module` (defaults to a sanitized `capability.id`, e.g., `company-lint` → `companyLint`)
*   `[env]` (optional): Environment variables the capability needs (see [Environment & Secrets](#environment--secrets))
*   `[mcp]` (optional): wraps an external MCP server and exposes its tools as functions
    *   `command`, `args`, `env`, `cwd`, `transport` (e.g., `stdio`)
    *   If both `tools/` and `[mcp]` are present, they share the same exported module; name collisions should fail fast.

**Filesystem discovery (MVP):**
*   `index.ts` is the entry point (loaded via `import()`).
*   `docs/` is indexed automatically (plus `definition.md`).
*   `rules/` is discovered automatically (`rules/*.md`).
*   `skills/` is discovered automatically (`skills/*/SKILL.md`).

Example MCP-based capability with environment variables:

```toml
[capability]
id = "aws"
name = "AWS"
version = "0.1.0"
description = "AWS operations via MCP."

[exports]
module = "aws"

[env]
# Required secrets (must be set in host environment or .omni/.env)
AWS_ACCESS_KEY_ID = { required = true, secret = true }
AWS_SECRET_ACCESS_KEY = { required = true, secret = true }
# Optional with default
AWS_REGION = { default = "us-east-1" }
# Simple passthrough (no validation)
AWS_PROFILE = {}

[mcp]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-aws"]
transport = "stdio"
```

### Capability Exports Interface

Since capabilities are Bun packages, **everything can be programmatic**. The `index.ts` is the single source of truth. Filesystem discovery (markdown files) is optional convenience.

```typescript
// capabilities/ralph/index.ts
import type { Capability, Skill, Rule, Doc } from '@omnidev/core';

// ============================================
// 1. SANDBOX TOOLS (functions LLMs can call)
// ============================================
export * from './state';
export * from './orchestrator';

// ============================================
// 2. CLI COMMANDS
// ============================================
export const cliCommands = {
  ralph: {
    description: 'AI agent orchestrator',
    subcommands: {
      init: { /* ... */ },
      start: { /* ... */ },
      stop: { /* ... */ },
      status: { /* ... */ },
    },
  },
};

// ============================================
// 3. TUI VIEWS
// ============================================
export { StatusView } from './cli/views/Status';
export const cliViews = {
  'ralph.status': 'StatusView',
};

// ============================================
// 4. SKILLS (programmatic - optional)
// ============================================
// Can export skills directly instead of using skills/*/SKILL.md
export const skills: Skill[] = [
  {
    name: 'prd-creation',
    description: 'Generate structured PRDs for AI-driven development workflows.',
    instructions: `
## When to use this skill
- Creating a new feature PRD
- Breaking down work into stories

## Key rules
- Ask clarifying questions first
- Create acceptance criteria for each story
    `,
  },
];

// ============================================
// 5. RULES (programmatic - optional)
// ============================================
// Can export rules directly instead of using rules/*.md
export const rules: Rule[] = [
  {
    name: 'iteration-workflow',
    content: `
# Iteration Workflow Rules
- Work on ONE story per iteration
- Read the spec file before implementing
- Run quality checks before committing
    `,
  },
];

// ============================================
// 6. DOCS (programmatic - optional)
// ============================================
// Can export docs directly, fetch from API, generate from code, etc.
export const docs: Doc[] = [
  {
    name: 'api-reference',
    content: generateApiDocs(), // Dynamic!
  },
];

// Or fetch from external source
export async function getDocs(): Promise<Doc[]> {
  const response = await fetch('https://api.example.com/docs');
  return response.json();
}

// ============================================
// 7. TYPE DEFINITIONS (programmatic - optional)
// ============================================
// Can export type defs instead of using types.d.ts file
export const typeDefinitions = `
export interface Story { id: string; title: string; passes: boolean; }
export interface PRD { name: string; userStories: Story[]; }
export function getPRD(name: string): Promise<PRD>;
export function getNextStory(prdName: string): Promise<Story | null>;
`;
```

### Programmatic vs Filesystem: Resolution Order

OmniDev checks exports first, then falls back to filesystem:

| Component | Programmatic Export | Filesystem Fallback |
|-----------|---------------------|---------------------|
| **Skills** | `export const skills: Skill[]` | `skills/*/SKILL.md` |
| **Rules** | `export const rules: Rule[]` | `rules/*.md` |
| **Docs** | `export const docs: Doc[]` or `getDocs()` | `docs/*.md` + `definition.md` |
| **Types** | `export const typeDefinitions: string` | `types.d.ts` |
| **Tools** | Named exports (functions) | — |
| **CLI** | `export const cliCommands` | — |
| **Views** | `export const cliViews` | — |

**Why this matters:**
- **Fetch from API**: Pull docs from Notion, Confluence, or your own service
- **Generate dynamically**: Create API docs from JSDoc comments
- **Conditional content**: Return different rules based on environment
- **Compute at runtime**: Skills that adapt to project state

### Installation & Management

*   **Manual**: Drop a folder into `omni/capabilities/`.
*   **Hub (Future)**: `omnidev install <capability>` downloads from a registry.
*   **Composition**: A user can mix and match. A "DevOps" capability might contain `kubectl` MCP (via `capability.toml`) AND a custom TypeScript module to parse logs (`tools/parser.ts`) AND documentation on deployment policy (`docs/deploy.md`) AND CLI commands (`cli/commands.ts`).

---

## Capability Sources & Versioning

OmniDev manages capabilities from multiple sources, each with different version management strategies. This enables everything from simple local capabilities to community-shared plugins with automatic updates.

### Capability Sources

Capabilities can come from three sources, configured per-capability:

| Source | Version Management | Use Case |
|--------|-------------------|----------|
| **Local** | Manual (no tracking) | Project-specific, custom capabilities |
| **Git** | Compare `package.json` versions | Community plugins, team-shared capabilities |
| **Hub** | Full versioning + registry | (Future) OmniDev Capabilities Hub |

### Source Configuration

Define capability sources in `omni/config.toml`:

```toml
# omni/config.toml

[capabilities]
# Local capabilities (default) - just enable by name
# These live in omni/capabilities/ or .omni/capabilities/
enable = ["ralph", "tasks", "my-local-cap"]

# Git-sourced capabilities
[capabilities.sources]
# Simple GitHub reference
obsidian-skills = "github:anthropics/obsidian-skills"

# Full configuration
aws-tools = {
  source = "github:company/aws-tools",
  ref = "v2.1.0",           # Pin to tag, branch, or commit
  path = "capabilities/aws" # Subdirectory within repo (optional)
}

# SSH for private repos
internal-tools = "git@github.com:company/internal-tools.git"

# Future: Hub source
# my-cap = { source = "hub:omnidev/my-cap", version = "^1.0.0" }
```

### Capability Versioning

All capabilities support versioning through `capability.toml` and/or `package.json`:

**Version resolution (precedence order):**
1. `capability.toml` → `[capability].version`
2. `package.json` → `version` field

```toml
# capability.toml
[capability]
id = "my-capability"
name = "My Capability"
version = "1.2.0"           # Semantic version
description = "A versioned capability"

[capability.metadata]
author = "Your Name"
repository = "https://github.com/user/my-capability"
license = "MIT"
```

### Version Management by Source

**Local capabilities:**
- No automatic version tracking
- You manage updates manually (copy/paste, git submodules, etc.)
- Version displayed from `capability.toml` or `package.json` if present

**Git-sourced capabilities:**
- OmniDev fetches `package.json` from the remote repository
- Compares remote version to local cached version
- Notifies you when updates are available
- You choose when to update

**Hub capabilities (future):**
- Full semantic versioning with constraints (`^1.0.0`, `~1.2.0`, etc.)
- Automatic update checks
- Changelogs and release notes
- Verified publishers

### Git Source Formats

| Format | Example | Notes |
|--------|---------|-------|
| **GitHub shorthand** | `github:user/repo` | Public repos |
| **GitHub with ref** | `github:user/repo#v1.0.0` | Pinned version |
| **Git HTTPS** | `https://github.com/user/repo.git` | Any Git host |
| **Git SSH** | `git@github.com:user/repo.git` | Private repos |

### Wrapping External Repositories

Third-party repositories (like Claude Code plugins) don't have OmniDev's capability structure. OmniDev can **wrap** these by discovering their content:

```
claude-code-plugins/       # External repo (no capability.toml)
├── README.md
├── LICENSE
├── skills/
│   ├── note-taking/       # Skill with multiple files
│   │   ├── SKILL.md
│   │   ├── template.md
│   │   └── scripts/
│   │       └── process.ts
│   └── daily-notes/
│       └── SKILL.md
├── agents/                # Or "subagents/"
│   ├── code-reviewer/
│   │   └── AGENT.md
│   └── researcher.md      # Single file agent
└── commands/
    └── deploy/
        └── COMMAND.md
```

**Configuration:**
```toml
[capabilities.sources.claude-plugins]
source = "github:user/claude-code-plugins"
type = "wrap"  # Auto-discover and wrap content
```

**Discovery rules:**

OmniDev scans for these directories and patterns:

| Directory | Patterns | What's discovered |
|-----------|----------|-------------------|
| `skills/` | `<name>/SKILL.md` or `<name>/skill.md` | Skills (entire folder contents) |
| `agents/` or `subagents/` | `<name>/AGENT.md`, `<name>.md` | Agents/Subagents |
| `commands/` | `<name>/COMMAND.md`, `<name>.md` | Commands |
| `rules/` | `*.md` | Rules |
| `docs/` | `*.md` | Documentation |

**Skill folders include all files:**
```
skills/note-taking/
├── SKILL.md          # Main skill definition
├── template.md       # Referenced by skill
└── scripts/
    └── process.ts    # Script used by skill
```
All files in the skill folder are preserved and available.

**Wrapping behavior:**
1. Clone repository to `.omni/capabilities/<id>/`
2. Generate `capability.toml` with commit hash as version
3. Discover all skills, agents, commands, rules, docs
4. Track in `.omni/capabilities.lock.toml`

**Generated capability.toml:**
```toml
# Auto-generated by OmniDev - DO NOT EDIT
[capability]
id = "claude-plugins"
name = "claude-plugins (wrapped)"
version = "abc123d"  # Short commit hash
description = "Wrapped from github:user/claude-code-plugins"

[capability.metadata]
repository = "https://github.com/user/claude-code-plugins"
wrapped = true
commit = "abc123def456789..."
```

**Version tracking for wrapped repos:**
- Commit hash IS the version (no `package.json`)
- Updates show as: `abc123d → def456a`
- Pin with `ref = "abc123..."` for stability

### Sync & Update Behavior

```bash
omnidev sync
# Output:
# ✓ Checking capability updates...
#   ⬆ obsidian-skills: 1.2.0 → 1.3.0 available
#   ✓ aws-tools: 2.1.0 (pinned)
#   ✓ internal-tools: up to date
# ✓ Generating agent configuration...
# ✓ Sync complete
```

**Update a specific capability:**
```bash
omnidev capability update obsidian-skills
# Downloads v1.3.0 and updates local cache
```

**Update all:**
```bash
omnidev capability update --all
```

### Local Storage

Git-sourced capabilities are cached in `.omni/capabilities/`:

```
.omni/
├── capabilities/
│   ├── obsidian-skills/     # Cloned from Git
│   │   ├── .git/
│   │   └── skills/
│   └── aws-tools/
├── capabilities.lock.toml   # Version lock file
└── ...
```

**capabilities.lock.toml:**
```toml
# Auto-generated - records installed versions

[obsidian-skills]
source = "github:anthropics/obsidian-skills"
version = "1.3.0"
commit = "abc123def456789..."
updated_at = "2026-01-12T10:30:00Z"

[aws-tools]
source = "github:company/aws-tools"
version = "2.1.0"
ref = "v2.1.0"  # Pinned
commit = "fedcba987654321..."
updated_at = "2026-01-10T08:15:00Z"
```

### CLI Commands

```bash
# List all capabilities with versions and sources
omnidev capability list
# ID              VERSION  SOURCE                    STATUS
# ralph           1.0.0    built-in                  enabled
# tasks           1.0.0    built-in                  enabled
# obsidian-skills 1.2.0    github:anthropics/...     enabled (update: 1.3.0)
# aws-tools       2.1.0    github:company/...        enabled (pinned)
# my-local-cap    0.1.0    local                     enabled

# Check for updates
omnidev capability check

# Update capabilities
omnidev capability update <name>
omnidev capability update --all

# Add a git-sourced capability
omnidev capability add github:user/repo

# Remove a capability
omnidev capability remove <name>
```

### Security Considerations

*   **Trust**: Git-sourced capabilities execute code. Only add repos you trust.
*   **Pin versions**: Use `ref = "v1.0.0"` for production stability.
*   **Review updates**: Check changelogs before updating.
*   **Private repos**: Configure SSH keys for private Git sources.

### Future: Capabilities Hub

The versioning system is designed to support a future **Capabilities Hub**:

*   **Central registry** at `hub.omnidev.dev`
*   **Semantic versioning** with dependency resolution
*   **Verified publishers** with signed packages
*   **Search & discovery** for community capabilities
*   **Enterprise** private hub instances

---

## Dependency Management & Workspaces

This is a critical architectural decision. Since performance and simplicity are core goals, OmniDev adopts a **Bun Workspaces** approach combined with **Symlinking** for the sandbox.

This avoids the complexity of bundling or copying massive `node_modules` folders while keeping the sandbox fast and standard.

### The Core Insight: "Capabilities are Packages"

Each capability is a standard Bun/npm package with its own `package.json`. The user's project root becomes a Bun Workspace.

```
my-project/
├── package.json              # Defines workspace: ["omni/capabilities/*"]
├── node_modules/             # Shared dependencies (hoisted)
├── omni/
│   └── capabilities/
│       ├── ralph/
│       │   ├── package.json  # Dependencies for 'ralph'
│       │   ├── capability.toml
│       │   ├── index.ts
│       │   └── ...
│       └── aws/
│           ├── package.json  # Dependencies for 'aws' (e.g. @aws-sdk/client-s3)
│           ├── capability.toml
│           └── index.ts
└── .omni/
    └── sandbox/              # Execution environment
        └── node_modules/     # Symlinks to capabilities
```

### How Dependencies Are Loaded

When the user runs `bun install` (or `omnidev install`):

1. Bun detects the workspace configuration in root `package.json`
2. It installs all dependencies for all capabilities into the root `node_modules/`
3. It links the capabilities themselves into `node_modules/` so they can import each other

**Why this is best:**
- **Speed**: No need to run `npm install` inside every capability folder manually
- **Disk Space**: Common dependencies (like `lodash` or `zod`) are shared/hoisted
- **Standard**: This is how modern JS/TS monorepos work

### How the Sandbox Loads Capabilities

The LLM writes code like:

```typescript
import * as ralph from 'ralph';
// ...
```

But `ralph` is located in `omni/capabilities/ralph`. The sandbox needs to resolve this.

**Solution: Symlinked Sandbox Modules**

Before running `omni_execute`, OmniDev prepares the sandbox:

1. Create/ensure `.omni/sandbox/node_modules/` exists
2. Symlink active capabilities into that folder
3. Execute the script with `.omni/sandbox/` as the working directory

```
.omni/sandbox/node_modules/ralph → ../../../omni/capabilities/ralph
.omni/sandbox/node_modules/aws   → ../../../omni/capabilities/aws
```

**Dependency Resolution Flow:**

```
import ... from 'ralph'
    → Found in .omni/sandbox/node_modules/ralph (Symlink)

Inside ralph, it does: import { someUtil } from 'lodash'
    → Bun looks in ralph/node_modules (Empty)
    → Bun walks up the directory tree to project root node_modules
    → Success! It finds lodash installed by the workspace
```

### Summary of Advantages

| Benefit | Description |
|---------|-------------|
| **Zero Build Step** | No bundling with Webpack/Esbuild. Run raw TypeScript via Bun. |
| **Native Speed** | Symlinks are instant. No file copying. |
| **Great DX** | Edit `omni/capabilities/ralph/index.ts`, next sandbox run uses changes immediately. |
| **Standard Tooling** | Works with any npm/Bun tooling. `bun install` just works. |
| **Shared Dependencies** | Common packages hoisted to root. Saves disk space. |

---

## Environment & Secrets

### The Problem

Capabilities often need API keys, tokens, and other secrets. Without explicit handling:
*   Users will hardcode secrets in `capability.toml` or `index.ts`
*   Secrets leak into Git history
*   Team members have no idea what environment variables are needed

### The Solution: `[env]` Table

Each capability declares its environment requirements in `capability.toml`:

```toml
[env]
# Required secret (fails if missing)
GITHUB_TOKEN = { required = true, secret = true }

# Required non-secret (visible in logs)
DATABASE_URL = { required = true }

# Optional with default
LOG_LEVEL = { default = "info" }

# Simple passthrough (optional, no validation)
DEBUG = {}
```

**Field definitions:**
*   `required`: If `true`, OmniDev fails fast if the variable is missing
*   `secret`: If `true`, the value is masked in logs and error messages
*   `default`: Fallback value if not set in environment

### Where Secrets Live

Secrets are loaded from multiple sources (in precedence order):

1. **Process environment** (highest priority) - for CI/CD
2. **`.omni/.env`** (gitignored) - local development secrets
3. **`~/.omni/.env`** - user-global secrets (shared across projects)

```bash
# .omni/.env (GITIGNORED - never committed!)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

---

## Skills & Rules System

Capabilities can contribute two types of agent instructions: **Skills** and **Rules**.

### Skills

Skills are agent behaviors that follow the [Agent Skills spec](https://github.com/anthropics/agent-skills). They are stored in `skills/*/SKILL.md` and define reusable behaviors.

**Location:** `capabilities/<name>/skills/<skill-name>/SKILL.md`

**Format:**
```markdown
---
name: prd-creation
description: Generate structured PRDs for AI-driven development workflows.
---

## Instructions

- Ask 3-5 clarifying questions before generating PRD
- Create user stories with acceptance criteria
- Link stories to spec files for detailed context
```

**Characteristics:**
- Skills define behaviors, workflows, and tool usage
- Compatible with Cursor and Claude Code
- Included when the capability is enabled

### Rules

Rules are simple markdown files with guidelines, constraints, or policies. They are stored in a `rules/` directory within the capability.

**Location:** `capabilities/<name>/rules/<rule-name>.md`

**Format:**
```markdown
<!-- rules/iteration-workflow.md -->

# Iteration Workflow Rules

- Work on ONE story per iteration
- Read the spec file before implementing
- Run quality checks before committing
- Commit with format: feat: [US-XXX] - Title
```

**Characteristics:**
- Rules define constraints, guidelines, and policies
- Simple markdown files (no special format required)
- Included when the capability is enabled

### When to Use Skills vs Rules

| Use Case | Skills | Rules |
|----------|--------|-------|
| Defining a workflow (e.g., PRD creation) | ✓ | |
| Code style guidelines | | ✓ |
| Tool usage instructions | ✓ | |
| Review checklist | | ✓ |
| Project constraints | | ✓ |
| Agent behavior patterns | ✓ | |

### Profiles Control What's Included

Profiles are **user-created groupings** that enable/disable capabilities at the project level:

```toml
# omni/config.toml (COMMITTED)
default_profile = "default"

[capabilities]
enable = ["ralph", "git"]

[profiles.frontend]
enable = ["ralph", "git", "react-rules", "css-standards"]

[profiles.backend]  
enable = ["ralph", "git", "api-rules", "database-rules"]
```

When you switch profiles, different capabilities become active. Since skills and rules live inside capabilities, switching profiles effectively changes which skills and rules are included in agent sync output.

---

## Agent Sync & Multi-Provider Support

OmniDev generates agent configuration files for multiple AI providers through a single command: `omnidev agents sync`.

### The Problem

Different AI assistants use different configuration formats:
- **Generic**: `agents.md` or `AGENTS.md` at repo root
- **Claude Code**: `.claude/claude.md` + `.claude/skills/` directory
- **Cursor**: `.cursor/rules/*.mdc` files

**Additional problem**: If we generate rules directly into committed files, switching profiles dirties git. Every profile switch = changed files = noisy diffs.

### The Solution: Reference Pattern

Generated content goes to `.omni/` (gitignored). Committed agent files **reference** the generated files.

**How it works:**
1. `omnidev agents sync` generates rules/skills to `.omni/generated/`
2. Committed files (`agents.md`, `.claude/claude.md`) contain static references
3. Profile switching only changes gitignored files — **git stays clean**

**Command:**
```bash
# Sync with current profile's enabled capabilities
omnidev agents sync

# Switch profile and auto-sync
omnidev profile set frontend  # Also runs agents sync
```

### What Gets Generated

**Skills** are written directly to provider locations (where they're discovered):

| Location | Git Status | Contents |
|----------|------------|----------|
| `.claude/skills/` | **Gitignored** | Skills for Claude Code (direct write) |
| `.cursor/rules/omnidev-*.mdc` | **Gitignored** | Rules for Cursor (direct write) |
| `.codex/skills/` | **Gitignored** | Skills for Codex (direct write) |

**Other generated content** goes to `.omni/generated/`:

| Location | Git Status | Contents |
|----------|------------|----------|
| `.omni/generated/rules.md` | Gitignored | Compiled rules (for reference files) |
| `.omni/generated/types.d.ts` | Gitignored | Type definitions for `omni_query` |
| `.omni/active-profile` | Gitignored | Current profile name |

---

## Sandbox Environment

### Implementation

The "sandbox" is best thought of as a **local playground / VM**, not a hard security boundary. Users add capabilities on their own machine and accept the risk.

*   **MVP target**: Fast local execution via Bun that can import capability modules and run scripts.
*   **Isolation (optional)**: Container/WASM/etc can be added later for teams that want stricter boundaries.
*   **Language**: TypeScript (executed via Bun).
*   **Repo + network access**: Default to full access (this is a developer tool), with optional guardrails rather than strict sandboxing.

### Code Mode Execution

Instead of single tool calls, the sandbox executes scripts:

```typescript
// The LLM writes this whole block:
import * as ralph from 'ralph';
import * as fs from 'fs';

export async function main(): Promise<number> {
  // 1. Get current PRD state
  const prd = await ralph.getPRD("user-auth");
  const story = await ralph.getNextStory("user-auth");

  // 2. Read spec and implement
  if (story) {
    const spec = fs.readFileSync(story.specFile, "utf-8");
    console.log(`Implementing: ${story.title}`);
    // ... implementation work ...
  }

  return 0;
}
```

---

## Git Safety Layer

This is a safety net for accidental changes and fast iteration. It is not a security boundary.

*   **Checkpointing**: Create a baseline checkpoint before running a mutation-heavy `omni_execute` (commit, stash, or patch-based snapshot).
*   **Change summaries**: `omni_execute` should return a concise summary (changed files + diff stats) to keep the agent honest.
*   **Rollback**: Provide a one-command rollback to the last checkpoint for "oops" recovery.
*   **Policy hooks (optional)**: Teams can add lint/test gates or "confirm destructive ops" rules as capabilities (not hardcoded).

---

## Directory Structure

### Project Structure (OmniDev Monorepo)

```
omnidev/
├── packages/
│   ├── core/                    # Shared types, capability loader, config
│   │   ├── src/
│   │   │   ├── capability/      # Capability discovery & loading
│   │   │   ├── config/          # TOML config parsing, layering
│   │   │   ├── sandbox/         # TypeScript execution environment
│   │   │   └── types/           # Shared interfaces
│   │   └── package.json
│   │
│   ├── cli/                     # Stricli CLI + OpenTUI
│   │   ├── src/
│   │   │   ├── commands/        # Built-in commands (init, serve, etc.)
│   │   │   ├── views/           # OpenTUI React components
│   │   │   └── app.ts           # CLI entry point
│   │   └── package.json
│   │
│   ├── mcp/                     # MCP Server
│   │   ├── src/
│   │   │   ├── server.ts        # MCP server setup
│   │   │   ├── tools/           # omni_query, omni_execute handlers
│   │   │   └── sandbox.ts       # Sandbox execution (runs code with capability modules)
│   │   └── package.json
│   │
│   └── create-capability/       # Scaffolding tool
│       └── ...
│
├── capabilities/                # Built-in capabilities (shipped with OmniDev)
│   └── ralph/
│       ├── capability.toml
│       ├── definition.md
│       ├── index.ts
│       ├── types.d.ts
│       ├── state.ts
│       ├── orchestrator.ts
│       ├── prompt.ts
│       ├── rules/
│       │   ├── prd-structure.md
│       │   └── iteration-workflow.md
│       └── skills/
│           ├── prd-creation/
│           │   └── SKILL.md
│           └── ralph-orchestration/
│               └── SKILL.md
│
├── bunfig.toml
├── package.json
└── tsconfig.json
```

### User Project Structure

OmniDev uses a **split directory strategy**: visible `omni/` for committed code, provider directories for skills (gitignored), `.omni/` for local state.

```
project-root/
├── agents.md                           # COMMITTED (static reference)
├── .claude/
│   ├── claude.md                       # COMMITTED (static reference)
│   └── skills/                         # GITIGNORED (skills written directly here)
│       ├── prd-creation/
│       │   └── SKILL.md
│       └── ralph-orchestration/
│           └── SKILL.md
├── .cursor/
│   └── rules/
│       ├── team-rules.mdc              # COMMITTED (team rules, optional)
│       └── omnidev-ralph.mdc           # GITIGNORED (generated by OmniDev)
│
├── omni/                               # OMNI_PROJECT (visible, COMMITTED)
│   ├── config.toml                     # Shared project configuration + profiles
│   ├── capabilities/                   # THE CAPABILITY REGISTRY
│   │   ├── ralph/                      # Built-in Ralph capability
│   │   │   ├── capability.toml
│   │   │   ├── definition.md
│   │   │   ├── index.ts
│   │   │   ├── types.d.ts
│   │   │   └── ...
│   │   ├── aws/                        # An MCP-based capability
│   │   │   ├── capability.toml         # Includes [mcp] and [env] config
│   │   │   └── definition.md
│   │   └── my-custom-tool/
│   │       ├── capability.toml
│   │       ├── definition.md
│   │       └── index.ts
│   └── profiles/                       # Optional: split profile definitions
│
├── .omni/                              # OMNI_LOCAL (hidden, GITIGNORED)
│   ├── config.local.toml               # Local overrides (personal settings)
│   ├── .env                            # Local secrets (API keys, tokens)
│   ├── active-profile                  # Current profile name (e.g., "frontend")
│   ├── generated/                      # Other generated content
│   │   ├── rules.md                    # Compiled rules from enabled capabilities
│   │   └── types.d.ts                  # Combined type definitions
│   ├── ralph/                          # Ralph state
│   │   ├── config.toml
│   │   ├── active-prd
│   │   ├── prds/
│   │   └── completed-prds/
│   ├── state/                          # Runtime state (cache, etc.)
│   ├── sandbox/                        # Execution scratch
│   └── server.pid                      # PID file for hot reload signals
│
└── .gitignore                          # Includes: .omni/, .claude/skills/, etc.
```

**What goes where:**

| Directory | Git Status | Contents |
|-----------|------------|----------|
| `omni/config.toml` | Committed | Team defaults, enabled capabilities, profiles |
| `omni/capabilities/` | Committed | Capability code, docs, skills, rules |
| `.omni/config.local.toml` | Ignored | Personal overrides, extra capabilities |
| `.omni/.env` | Ignored | API keys, tokens, secrets |
| `.omni/ralph/` | Ignored | Ralph PRDs, progress, state |
| `.omni/state/` | Ignored | Cache, session state |
| `.omni/sandbox/` | Ignored | Temporary code execution |
| `.omni/types/` | Ignored | Generated TypeScript definitions |

---

## Configuration System

### Layered Configuration (Team Support)

OmniDev supports a hierarchical configuration model with clear separation of shared and personal settings.

| Layer | Location | Git Status | Purpose |
|-------|----------|------------|---------|
| **Global** | `~/.omni/config.toml` | N/A | User preferences, personal defaults |
| **Team** | `omni/config.toml` | Committed | Shared capabilities, project defaults |
| **Local** | `.omni/config.local.toml` | Ignored | Personal overrides, extra tools |

### Precedence & Merge Rules (MVP)

*   **Precedence**: `.omni/config.local.toml` → `omni/config.toml` → `~/.omni/config.toml` (local wins).
*   **Tables**: Deep-merge by key.
*   **Scalars**: Override.
*   **Capability enable/disable**: Union across layers (final enabled = enable − disable).
*   **Environment variables**: Layer-specific `[env]` tables are merged (local overrides team).

### Configuration Files

**Team Configuration** (`omni/config.toml` - COMMITTED):

```toml
# omni/config.toml - Shared with team via Git
project = "backend-api"
default_profile = "coding"

[capabilities]
# Team-agreed set of capabilities
enable = ["ralph", "git", "company-lint", "aws"]
disable = []

[env]
# Team defaults (non-secret)
AWS_REGION = "eu-west-1"
LOG_LEVEL = "info"

[profiles.planning]
enable = ["ralph", "research"]
disable = ["git", "company-lint"]

[profiles.coding]
enable = ["git", "company-lint"]
disable = ["research"]
```

**Local Configuration** (`.omni/config.local.toml` - GITIGNORED):

```toml
# .omni/config.local.toml - Personal overrides
[capabilities]
# Add personal tools that aren't shared with team
enable = ["my-debug-tools", "personal-notes"]

[env]
# Personal overrides
AWS_PROFILE = "nikola-dev"  # Use my personal AWS profile
LOG_LEVEL = "debug"         # I want more logging
```

**Secrets** (`.omni/.env` - GITIGNORED):

```bash
# .omni/.env - Never committed!
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

---

## Profiles System

Profiles are named presets for *which capabilities are active right now* (and optionally, which skill files get loaded).

*   **Why**: Planning, research, and coding benefit from different tools and different "agent posture".
*   **Where**: Define profiles inline in `omni/config.toml` (`[profiles.<name>]`) and/or as separate TOML files in `omni/profiles/`.
*   **Selection**: Choose an active profile via CLI (`--profile coding`) or by the calling client.
*   **Default**: If no profile is selected, run with the base `capabilities.enable/disable` only (or a configured default profile).
*   **Resolution**: Start from base `capabilities.enable/disable`, then apply the profile's `enable/disable`.

---

## Ralph - AI Agent Orchestrator

### Ralph as a Capability

Ralph is the **built-in AI orchestrator capability**. It enables long-running, PRD-driven development through iterative AI agent invocations. Each iteration works on one user story until all acceptance criteria are met.

Ralph provides:
1.  **Schema**: Defines what a PRD and Story look like
2.  **Functions**: `ralph.getPRD()`, `ralph.getNextStory()`, `ralph.markStoryPassed()`, etc.
3.  **CLI Commands**: `omnidev ralph init`, `omnidev ralph start`, etc.
4.  **TUI Views**: Interactive status view, PRD list, story list
5.  **Skills & Rules**: PRD creation skill, iteration workflow rules

### Ralph State Structure

```
.omni/ralph/
├── config.toml          # Ralph configuration
├── active-prd           # Currently active PRD name
├── prds/
│   └── <prd-name>/
│       ├── prd.json     # PRD definition with stories
│       ├── progress.txt # Progress log with learnings
│       └── specs/       # Detailed spec files
└── completed-prds/      # Archived completed PRDs
```

### Ralph CLI Commands

```bash
# Core commands
omnidev ralph init                    # Initialize Ralph in project
omnidev ralph start [--agent <name>]  # Start orchestration
omnidev ralph stop                    # Gracefully stop
omnidev ralph status                  # View current state

# PRD management
omnidev ralph prd list                # List all PRDs
omnidev ralph prd create <name>       # Create new PRD
omnidev ralph prd select <name>       # Set active PRD
omnidev ralph prd archive <name>      # Archive completed PRD

# Story management
omnidev ralph story list              # List stories
omnidev ralph story pass <id>         # Mark passed
omnidev ralph story reset <id>        # Reset to failed

# Utilities
omnidev ralph log [--tail <n>]        # View progress log
omnidev ralph patterns                # View codebase patterns
```

### Multi-Agent Support

Ralph supports multiple AI agents:

```toml
# .omni/ralph/config.toml
[ralph]
default_agent = "claude"
default_iterations = 10

[agents.claude]
command = "npx"
args = ["-y", "@anthropic-ai/claude-code", "--model", "sonnet", "-p"]

[agents.codex]
command = "npx"
args = ["-y", "@openai/codex", "exec", "-"]

[agents.amp]
command = "amp"
args = ["--dangerously-allow-all"]
```

---

## CLI Interface

The CLI is built with **Stricli** and uses **OpenTUI** for rich terminal interfaces. It serves two purposes:
1.  Running OmniDev as an MCP server
2.  Managing project configuration and capabilities
3.  Hosting capability-contributed commands and views

### Built-in Commands

*   `omnidev init` - Create `omni/` and `.omni/` directories with starter config.
*   `omnidev serve` - Start the MCP server that exposes `omni_query` and `omni_execute`.
    *   Key flags: `--omni-dir <path>`, `--profile <name>`.
*   `omnidev capability list|enable|disable` - Manage active capabilities for a project.
*   `omnidev profile list|set` - Inspect and switch profiles.
*   `omnidev agents sync` - Generate agent config files for all providers.
    *   Key flags: `--profile <name>`, `--providers <list>`.
    *   Generates: `agents.md`, `.claude/claude.md`, `.cursor/rules/omnidev.mdc`.
*   `omnidev doctor` - Validate runtime dependencies and configuration.

### Capability-Contributed Commands

Capabilities can contribute commands that appear under `omnidev <capability> <command>`. For example, the `ralph` capability adds:

*   `omnidev ralph init` - Initialize Ralph in project
*   `omnidev ralph start` - Start PRD-driven orchestration
*   `omnidev ralph status` - View current PRD and story status
*   `omnidev ralph prd create` - Create a new PRD

---

## Demo Scenarios

1.  **PRD → Execute loop (no context bloat)**
    *   Enable `ralph` and `git` capabilities.
    *   Use Ralph to create a PRD with user stories.
    *   Run `omnidev ralph start` to begin iterative development.

2.  **Wrap an MCP server as a capability**
    *   Create `omni/capabilities/aws/capability.toml` with an `[mcp]` block.
    *   OmniDev supervises the MCP process and exposes tools as `aws.*` functions in the sandbox.

3.  **Docs + skills + rules steer behavior**
    *   Add `docs/`, `skills/`, and `rules` to a capability (e.g., `company-lint`).
    *   Skills define always-on behaviors; rules are profile-specific.
    *   Run `omnidev agents sync` to generate config files for all AI providers.

4.  **Extend the CLI with custom commands**
    *   Create a capability with `cli/commands.ts` and `cli/views/`.
    *   The CLI automatically picks up the new commands and views.
    *   Run `omnidev <your-capability> <your-command>` to see it in action.

5.  **Multi-provider agent sync**
    *   Configure capabilities with skills and rules.
    *   Run `omnidev agents sync --profile coding` to generate:
        *   `agents.md` for generic use
        *   `.claude/claude.md` for Claude Code
        *   `.cursor/rules/omnidev.mdc` for Cursor
    *   Switch profiles and re-sync to get different rules in the output.

---

## Technical Notes

*   **Not a security boundary**: The "sandbox" is trusted local execution; guardrails are UX features (git checkpoints, confirmations, lint/test hooks).
*   **Directory split**: `omni/` is visible and committed (capabilities, shared config); `.omni/` is hidden and gitignored (state, sandbox, secrets, generated files).
*   **Reference pattern**: Committed agent files (`agents.md`, `.claude/claude.md`) reference gitignored generated files in `.omni/generated/`. Profile switching doesn't dirty git.
*   **Generated files**: All profile-dependent output goes to `.omni/generated/` (rules.md, skills.md, types.d.ts, cursor-rules.md).
*   **Active profile**: Stored in `.omni/active-profile` (gitignored). Read at startup and when reloading.
*   **Hot reload**: MCP server watches config and capability files. Profile switch triggers automatic sync and reload notification.
*   **Capability loading**: Discover `omni/capabilities/*/capability.toml`, dynamically `import()` the `index.ts`, and register exports.
*   **MCP bridging**: When `[mcp]` is present, spawn/supervise the server and generate callable wrappers from the tool schemas.
*   **Type generation**: On capability load, generate `.d.ts` files to `.omni/generated/types.d.ts` for LLM consumption via `omni_query`.
*   **Indexing**: `definition.md` + `docs/` should be searchable via `omni_query` without dumping full documents into context.
*   **Environment injection**: Load `[env]` from capability.toml, merge with `.omni/.env` and process env, inject into sandbox.
*   **Secret masking**: Variables marked `secret = true` are masked in logs and error messages.
*   **CLI extension**: Stricli commands from capabilities are merged into the main CLI at startup.
*   **TUI rendering**: OpenTUI views are rendered when a command specifies a view in `cliViews`.
*   **Skills loading**: `skills/*/SKILL.md` files are parsed (YAML frontmatter + Markdown body) and collected at startup.
*   **Rules loading**: `rules/*.md` from capabilities are collected and filtered by active profile.
*   **Agent sync**: `omnidev agents sync` compiles skills + rules → `.omni/generated/`. `omnidev profile set` automatically calls sync.
*   **Capability sources**: Local (manual), Git (version compared via `package.json`), Hub (future, full versioning).
*   **Git-sourced capabilities**: Cloned to `.omni/capabilities/<name>/`. Version locked in `.omni/capabilities.lock.toml`.
*   **Version resolution**: Check `capability.toml` version first, then `package.json`.

---

## Future Features

*   **Remote Sandboxes**: Execute code in a cloud container for heavy workloads.
*   **Capabilities Hub**: Building on the [Remote Capabilities](#remote-capabilities--versioning) foundation:
    *   Central registry at `hub.omnidev.dev` for discovery and search
    *   `omnidev install user/capability` as shorthand for adding remote capabilities
    *   Verified publishers with signed capability packages
    *   Community ratings, reviews, and usage statistics
    *   Automatic update notifications with changelogs
    *   Enterprise private hub instances for organizations
    *   CLI integration: `omnidev hub search`, `omnidev hub publish`
*   **Binary Distribution**: Compile to single executable via `bun build --compile`.
*   **Capability Analytics**: Track which capabilities are most used, performance metrics, and adoption trends.
