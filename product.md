# OmniDev Product Specification

> **Status**: MVP Draft v0.7
> **Last Updated**: 2026-01-08

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
6. [Dependency Management & Workspaces](#dependency-management--workspaces)
7. [Environment & Secrets](#environment--secrets)
8. [Skills & Rules System](#skills--rules-system)
9. [Agent Sync & Multi-Provider Support](#agent-sync--multi-provider-support)
10. [Sandbox Environment](#sandbox-environment)
11. [Git Safety Layer](#git-safety-layer)
12. [Directory Structure](#directory-structure)
13. [Configuration System](#configuration-system)
14. [Profiles System](#profiles-system)
15. [Task & Plan Management](#task--plan-management)
16. [CLI Interface](#cli-interface)
17. [Demo Scenarios](#demo-scenarios)
18. [Technical Notes](#technical-notes)
19. [Future Features](#future-features)

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
*   **Workflows → Code**: Task management becomes `tasks.*` functions.
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

1.  **Flexible Task Management**: "Tasks" are just a capability. Users can swap the default task system for a custom Jira or Trello capability.
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

## The Two MCP Tools

OmniDev exposes exactly **two** tools to the LLM. Everything else (MCP tools, workflows, docs) becomes code inside the execution environment.

### Tool 1: `omni_query`

Discovery + search without dumping tons of context.

**Uses (MVP):**
*   Search across active capabilities, docs, and skills without dumping full content into context
*   Return short snippets (optionally tagged as capability/doc/skill)
*   If `query` is empty, return a compact summary of what's currently enabled
*   **Return type definitions** (`.d.ts`) so the LLM can "compile" code mentally before writing

**Request shape (MVP):**

```json
{
  "query": "search query",
  "limit": 10,
  "include_types": false
}
```

**Response shape (MVP):**

```text
1) [capability:company-lint] "..."
2) [doc:company-lint] "..."
3) [skill:company-lint] "..."
```

**Type definitions response** (when `include_types: true` or `query` is empty):

The LLM needs to know function signatures to write correct code. When requested, `omni_query` returns a virtually concatenated `.d.ts` file of all enabled capabilities:

```typescript
// Auto-generated type definitions for enabled capabilities

declare module 'tasks' {
  export type Status = 'todo' | 'in_progress' | 'blocked' | 'done';
  
  export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: Status;
    tags: string[];
    createdAt: number;
    updatedAt: number;
  }
  
  export function create(title: string, description?: string | null, tags?: string[]): Promise<string>;
  export function list(status?: Status): Promise<Task[]>;
  export function get(taskId: string): Promise<Task>;
  export function update(taskId: string, fields: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task>;
  export function complete(taskId: string): Promise<Task>;
}

declare module 'aws' {
  export function s3ListBuckets(): Promise<{ name: string; createdAt: Date }[]>;
  export function s3Create(bucketName: string): Promise<void>;
  export function s3Exists(bucketName: string): Promise<boolean>;
  // ...
}
```

This allows the LLM to write type-safe code without guessing function signatures.

### Tool 2: `omni_execute`

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
import * as tasks from 'tasks';
import * as fs from 'fs';

export async function main(): Promise<number> {
  // Create a task
  const taskId = await tasks.create("Implement feature X");
  
  // Read a file
  const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
  
  // Do work...
  console.log(`Created task ${taskId} for project ${config.name}`);
  
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
│       └── TaskList.tsx
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
    *   **Export rule (MVP)**: Functions exported from `index.ts` become attributes on the capability module (e.g., `tasks.create()`).

5.  **`cli/` (CLI Extensions)**
    *   `commands.ts`: Stricli command definitions that extend the CLI.
    *   `views/`: OpenTUI React components for rich terminal UIs.
    *   These are registered when the capability loads, adding commands like `omnidev tasks list`.

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

A capability's `index.ts` exports a unified interface:

```typescript
// capabilities/tasks/index.ts
import type { CapabilityExports, Rule } from '@omnidev/core';

// Re-export sandbox functions
export * from './tools/taskManager';

// CLI command definitions (Stricli format)
export const cliCommands = {
  tasks: {
    description: 'Manage tasks',
    subcommands: {
      list: { /* ... */ },
      add: { /* ... */ },
    },
  },
};

// OpenTUI views
export { TaskListView } from './cli/views/TaskList';

// Map commands to views
export const cliViews = {
  'tasks.list': 'TaskListView',
};

// Note: Skills are loaded from skills/*/SKILL.md
// Note: Rules are loaded from rules/*.md
```

### Installation & Management

*   **Manual**: Drop a folder into `omni/capabilities/`.
*   **Hub (Future)**: `omnidev install <capability>` downloads from a registry.
*   **Composition**: A user can mix and match. A "DevOps" capability might contain `kubectl` MCP (via `capability.toml`) AND a custom TypeScript module to parse logs (`tools/parser.ts`) AND documentation on deployment policy (`docs/deploy.md`) AND CLI commands (`cli/commands.ts`).

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
│       ├── tasks/
│       │   ├── package.json  # Dependencies for 'tasks' (e.g. uuid, zod)
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
import * as tasks from 'tasks';
// ...
```

But `tasks` is located in `omni/capabilities/tasks`. The sandbox needs to resolve this.

**Solution: Symlinked Sandbox Modules**

Before running `omni_execute`, OmniDev prepares the sandbox:

1. Create/ensure `.omni/sandbox/node_modules/` exists
2. Symlink active capabilities into that folder
3. Execute the script with `.omni/sandbox/` as the working directory

```
.omni/sandbox/node_modules/tasks → ../../../omni/capabilities/tasks
.omni/sandbox/node_modules/aws   → ../../../omni/capabilities/aws
```

**Dependency Resolution Flow:**

```
import ... from 'tasks'
    → Found in .omni/sandbox/node_modules/tasks (Symlink)

Inside tasks, it does: import { S3 } from '@aws-sdk/client-s3'
    → Bun looks in tasks/node_modules (Empty)
    → Bun walks up the directory tree to project root node_modules
    → Success! It finds the SDK installed by the workspace
```

### Implementation Details

#### `capability.toml` vs `package.json`

Keep both, with clear responsibilities:

| File | Purpose |
|------|---------|
| `capability.toml` | OmniDev-specific metadata: `[cli]`, `[env]`, `[mcp]`, skills, rules |
| `package.json` | Standard npm package: dependencies, `main` entry point |

`index.ts` should be the `main` entry in `package.json`.

**Example `package.json` for a capability:**

```json
{
  "name": "tasks",
  "version": "0.1.0",
  "main": "index.ts",
  "type": "module",
  "dependencies": {
    "zod": "^3.22.0"
  }
}
```

#### `omnidev init` Command Updates

Must generate a root `package.json` if one doesn't exist:

```json
{
  "name": "my-omnidev-project",
  "private": true,
  "workspaces": [
    "omni/capabilities/*"
  ]
}
```

#### Sandbox Pre-flight Check

When `omni_execute` receives code, it quickly verifies symlinks exist:

```typescript
// packages/mcp/src/sandbox.ts
import { symlink, mkdir } from 'fs/promises';
import { join } from 'path';

async function prepareSandbox(activeCapabilities: Capability[]) {
  const sandboxNodeModules = '.omni/sandbox/node_modules';
  await mkdir(sandboxNodeModules, { recursive: true });
  
  for (const cap of activeCapabilities) {
    const linkPath = join(sandboxNodeModules, cap.config.exports?.module ?? cap.id);
    const targetPath = `../../../omni/capabilities/${cap.id}`;
    
    try {
      await symlink(targetPath, linkPath);
    } catch (e) {
      // Link may already exist
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }
}
```

### Handling Remote Capabilities (Future)

When the Capability Hub is added:

1. `omnidev install user/cool-tool` downloads the folder to `omni/capabilities/cool-tool/`
2. OmniDev runs `bun install` at the project root
3. The workspace picks up the new `package.json` and installs its dependencies
4. Symlinks are created on next `omni_execute`
5. Ready to use

### Naming Collision Mitigation

**Risk**: A capability named `fs` or `path` (shadowing built-ins) or `react` (shadowing npm packages).

**Mitigation strategies:**

| Strategy | Description |
|----------|-------------|
| **Block reserved names** | Reject capabilities named `fs`, `path`, `http`, `crypto`, etc. |
| **Namespace prefix** | Force imports to be `@cap/tasks` instead of `tasks` |
| **Validation on load** | Warn if a capability name shadows a common npm package |

**MVP approach**: Block reserved names. Maintain a deny-list of Node.js built-ins and common npm packages.

```typescript
const RESERVED_NAMES = [
  // Node.js built-ins
  'fs', 'path', 'http', 'https', 'crypto', 'os', 'child_process',
  'stream', 'buffer', 'util', 'events', 'net', 'url', 'querystring',
  // Common npm packages
  'react', 'vue', 'lodash', 'axios', 'express', 'typescript',
];

function validateCapabilityName(name: string): void {
  if (RESERVED_NAMES.includes(name)) {
    throw new Error(`Capability name "${name}" is reserved. Choose a different name.`);
  }
}
```

### Summary of Advantages

| Benefit | Description |
|---------|-------------|
| **Zero Build Step** | No bundling with Webpack/Esbuild. Run raw TypeScript via Bun. |
| **Native Speed** | Symlinks are instant. No file copying. |
| **Great DX** | Edit `omni/capabilities/tasks/index.ts`, next sandbox run uses changes immediately. |
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

### Sandbox Injection

The sandbox automatically receives declared environment variables:

```typescript
// In capability code (tools/github.ts)
export async function createIssue(title: string) {
  // GITHUB_TOKEN is available because capability.toml declared it
  const token = process.env.GITHUB_TOKEN;
  // ...
}
```

**Security notes:**
*   Only variables declared in `[env]` are passed to capability code
*   Undeclared variables from the host are NOT available (no ambient access)
*   This prevents capabilities from reading arbitrary secrets

### Config Overrides

Team defaults can be set in `omni/config.toml`, with personal overrides in `.omni/config.local.toml`:

```toml
# omni/config.toml (COMMITTED - team defaults)
[env]
AWS_REGION = "eu-west-1"  # Team's default region

# .omni/config.local.toml (GITIGNORED - personal overrides)
[env]
AWS_PROFILE = "nikola-dev"  # My personal AWS profile
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
name: task-management
description: Maintain an explicit plan and update tasks as work progresses.
---

## Instructions

- Maintain an explicit plan before executing multi-step work.
- Keep exactly one plan step `in_progress` at a time.
- When you finish a meaningful unit of work, update the plan before continuing.
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
<!-- rules/code-quality.md -->

# Code Quality Rules

- Write clean, readable code with meaningful variable names
- Add comments for complex logic
- Keep functions small and focused
- Handle errors appropriately
```

**Characteristics:**
- Rules define constraints, guidelines, and policies
- Simple markdown files (no special format required)
- Included when the capability is enabled

### When to Use Skills vs Rules

| Use Case | Skills | Rules |
|----------|--------|-------|
| Defining a workflow (e.g., task management) | ✓ | |
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
enable = ["tasks", "git"]

[profiles.frontend]
enable = ["tasks", "git", "react-rules", "css-standards"]

[profiles.backend]  
enable = ["tasks", "git", "api-rules", "database-rules"]
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

### Why Skills Go Directly to Provider Locations

Providers discover skills in specific directories:
- Claude Code looks in `.claude/skills/`
- Cursor looks in `.cursor/rules/`
- Codex looks in `.codex/skills/`

We can't change where they look, so we write directly there. **These directories should be gitignored** since they're profile-dependent.

### Committed Reference Files

These files are committed once and rarely change:

**`agents.md`** (committed):
```markdown
# Agent Configuration

> Managed by OmniDev. Do not edit directly.
> Run `omnidev agents sync` to update.

<!-- Import generated rules (gitignored) -->
@import .omni/generated/rules.md
```

**`.claude/claude.md`** (committed):
```markdown
# Claude Code Configuration

> Managed by OmniDev.
> Skills are in `.claude/skills/` (gitignored, profile-dependent)
> Run `omnidev agents sync` to regenerate.

See: `.omni/generated/rules.md` for current rules.
```

### Example Output Structure

```
project-root/
├── agents.md                    # COMMITTED (static reference)
├── .claude/
│   ├── claude.md                # COMMITTED (static reference)
│   └── skills/                  # GITIGNORED (generated directly here)
│       ├── task-management/
│       │   └── SKILL.md
│       └── code-review/
│           └── SKILL.md
├── .cursor/
│   └── rules/
│       ├── .gitignore           # Ignore omnidev-*.mdc
│       └── omnidev-tasks.mdc    # GITIGNORED (generated directly here)
├── omni/                        # COMMITTED
│   ├── config.toml              # Team config, profiles defined here
│   └── capabilities/
│       └── ...
└── .omni/                       # GITIGNORED
    ├── config.local.toml        # Personal overrides
    ├── .env                     # Secrets
    ├── active-profile           # Current profile name (e.g., "frontend")
    ├── generated/               # Other generated content
    │   ├── rules.md             # Compiled rules for current profile
    │   └── types.d.ts           # Type definitions
    ├── state/
    └── sandbox/
```

### Gitignore Entries

`omnidev init` adds these to `.gitignore`:

```gitignore
# OmniDev - local state and generated content
.omni/

# Provider-specific generated content (profile-dependent)
.claude/skills/
.cursor/rules/omnidev-*.mdc
.codex/skills/
```

### Why This Design?

| Scenario | Old Design | New Design |
|----------|------------|------------|
| Switch profile | `agents.md` changes, dirty git | Only gitignored dirs change |
| Team member pulls | Gets your profile's rules | Gets reference files, generates own |
| CI/CD | Profile state in repo | Profile set per environment |
| Skills discovery | Providers can't find them | Written directly where providers look |

### How Profiles Affect Output

Profiles control which capabilities are enabled. When you switch profiles, `.omni/generated/` is updated with the new profile's rules and skills.

**Example:** If you have two profiles:
- `frontend` profile enables: `tasks`, `react-rules`, `css-standards`
- `backend` profile enables: `tasks`, `api-rules`, `database-rules`

```bash
# Switch to frontend profile
omnidev profile set frontend

# This updates:
# - .omni/active-profile → "frontend"
# - .omni/generated/rules.md → rules from tasks, react-rules, css-standards
# - .omni/generated/skills.md → skills from those capabilities
# - .omni/generated/types.d.ts → type definitions
#
# Git stays clean! Only .omni/ (gitignored) changes.
```

**Example `.omni/generated/rules.md`** (gitignored, generated):
```markdown
# Active Rules

> Profile: frontend
> Generated: 2026-01-08T10:30:00Z
> Capabilities: tasks, react-rules, css-standards

## task-workflow (from tasks)

- Always check the current task list before starting new work
- Keep exactly one task in_progress at a time

## react-best-practices (from react-rules)

- Use functional components with hooks
- Keep components small and focused
...
```

---

## Hot Reload & Change Detection

The OmniDev MCP server must react to changes in configuration, capabilities, and generated files.

### What Triggers a Reload

| Change | Effect |
|--------|--------|
| `omni/config.toml` modified | Reload config, re-resolve enabled capabilities |
| `.omni/config.local.toml` modified | Reload config, re-resolve enabled capabilities |
| `omni/capabilities/*/` modified | Reload affected capability |
| `.omni/active-profile` modified | Reload with new profile's capabilities |
| `omnidev profile set <name>` | Write `.omni/active-profile`, trigger sync, notify server |
| `omnidev agents sync` | Regenerate `.omni/generated/*`, notify server |

### Implementation Options

**Option A: File Watching (Recommended for MVP)**

```typescript
// packages/mcp/src/watcher.ts
import { watch } from 'fs';

const WATCH_PATHS = [
  'omni/config.toml',
  '.omni/config.local.toml',
  '.omni/active-profile',
  'omni/capabilities/',
];

export function startWatcher(onReload: () => void) {
  for (const path of WATCH_PATHS) {
    watch(path, { recursive: true }, (event, filename) => {
      console.log(`[omnidev] Change detected: ${filename}`);
      onReload();
    });
  }
}
```

**Option B: Signal-Based (Unix)**

CLI commands send a signal to the running server:

```bash
# omnidev profile set frontend
# 1. Writes .omni/active-profile
# 2. Runs agents sync
# 3. Sends SIGHUP to omnidev server (if running)
kill -HUP $(cat .omni/server.pid)
```

**Option C: State File Polling**

Server checks `.omni/state/reload-trigger` before each operation:

```typescript
// Before handling omni_query or omni_execute
const trigger = await Bun.file('.omni/state/reload-trigger').text();
if (trigger !== lastTrigger) {
  await reloadCapabilities();
  lastTrigger = trigger;
}
```

### Automatic Sync on Profile Switch

`omnidev profile set` should be a single command that does everything:

```bash
omnidev profile set frontend
```

This command:
1. Writes `frontend` to `.omni/active-profile`
2. Runs `omnidev agents sync` (regenerates `.omni/generated/*`)
3. Notifies the MCP server to reload (if running)

```typescript
// packages/cli/src/commands/profile.ts
export async function setProfile(name: string) {
  // 1. Validate profile exists
  const config = await loadConfig();
  if (!config.profiles?.[name]) {
    throw new Error(`Unknown profile: ${name}`);
  }
  
  // 2. Write active profile
  await Bun.write('.omni/active-profile', name);
  
  // 3. Regenerate agent files
  await syncAgents();
  
  // 4. Notify server (if running)
  await notifyServer('reload');
  
  console.log(`✓ Switched to profile: ${name}`);
}
```

---

## Sandbox Environment

### Implementation

The "sandbox" is best thought of as a **local playground / VM**, not a hard security boundary. Users add capabilities on their own machine and accept the risk.

*   **MVP target**: Fast local execution via Bun that can import capability modules and run scripts.
*   **Isolation (optional)**: Container/WASM/etc can be added later for teams that want stricter boundaries.
*   **Language**: TypeScript (executed via Bun).
*   **Repo + network access**: Default to full access (this is a developer tool), with optional guardrails rather than strict sandboxing.
    *   *Optional: Read-Only* - Useful for analysis-only sessions.

### Code Mode Execution

Instead of single tool calls, the sandbox executes scripts:

```typescript
// The LLM writes this whole block:
import * as aws from 'aws';
import * as fs from 'fs';

export async function main(): Promise<number> {
  // 1. Get data
  const config = JSON.parse(fs.readFileSync("config.prod.json", "utf-8"));

  // 2. Logic & Transformation
  const bucketName = `backup-${config.id}`;

  // 3. Execution
  if (!(await aws.s3Exists(bucketName))) {
    await aws.s3Create(bucketName);
    console.log(`Created ${bucketName}`);
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
│   └── tasks/
│       ├── capability.toml
│       ├── definition.md
│       ├── index.ts
│       ├── tools/
│       ├── cli/
│       ├── docs/
│       └── skills/
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
│       └── task-management/
│           └── SKILL.md
├── .cursor/
│   └── rules/
│       ├── team-rules.mdc              # COMMITTED (team rules, optional)
│       └── omnidev-tasks.mdc           # GITIGNORED (generated by OmniDev)
│
├── omni/                               # OMNI_PROJECT (visible, COMMITTED)
│   ├── config.toml                     # Shared project configuration + profiles
│   ├── capabilities/                   # THE CAPABILITY REGISTRY
│   │   ├── tasks/                      # A built-in capability
│   │   │   ├── capability.toml
│   │   │   ├── definition.md
│   │   │   ├── index.ts
│   │   │   ├── types.d.ts              # Type definitions for LLM
│   │   │   ├── tools/
│   │   │   │   └── taskManager.ts
│   │   │   ├── cli/
│   │   │   │   ├── commands.ts
│   │   │   │   └── views/
│   │   │   │       └── TaskList.tsx
│   │   │   ├── docs/
│   │   │   ├── rules/
│   │   │   │   └── task-workflow.md
│   │   │   └── skills/
│   │   │       └── task-management/
│   │   │           └── SKILL.md        # Source skill (in capability)
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
│   ├── state/                          # Runtime state (tasks DB, cache, etc.)
│   ├── sandbox/                        # Execution scratch
│   └── server.pid                      # PID file for hot reload signals
│
└── .gitignore                          # Includes: .omni/, .claude/skills/, etc.
│
└── .gitignore                          # Must include: .omni/
```

**What goes where:**

| Directory | Git Status | Contents |
|-----------|------------|----------|
| `omni/config.toml` | Committed | Team defaults, enabled capabilities, profiles |
| `omni/capabilities/` | Committed | Capability code, docs, skills, rules |
| `.omni/config.local.toml` | Ignored | Personal overrides, extra capabilities |
| `.omni/.env` | Ignored | API keys, tokens, secrets |
| `.omni/state/` | Ignored | Task database, session state |
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
enable = ["tasks", "git", "company-lint", "aws"]
disable = []

[env]
# Team defaults (non-secret)
AWS_REGION = "eu-west-1"
LOG_LEVEL = "info"

[profiles.planning]
enable = ["tasks", "research"]
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

## Task & Plan Management

### Tasks as a Capability

The Task system is **not hardcoded**. It is a default capability (`builtin/tasks` or `omni/capabilities/tasks`) that provides:
1.  **Schema**: Defines what a task looks like (title, status, validators).
2.  **Functions**: `tasks.list()`, `tasks.complete()`, `tasks.validate()`.
3.  **CLI Commands**: `omnidev tasks list`, `omnidev tasks add`, etc.
4.  **TUI Views**: Interactive task list, board view, etc.
5.  **Context**: Injects prompt instructions on how to manage the plan.

For a concrete minimal implementation, see `example-basic.md`.

If a user wants to use GitHub Issues instead:
1.  Disable the `tasks` capability.
2.  Enable a `github-issues` capability.
3.  The sandbox now has `github.issues.create()` instead of `tasks.create()`, and the CLI has `omnidev github issues list` instead of `omnidev tasks list`.

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

Capabilities can contribute commands that appear under `omnidev <capability> <command>`. For example, the `tasks` capability adds:

*   `omnidev tasks list` - List all tasks (with optional TUI view)
*   `omnidev tasks add <title>` - Create a new task
*   `omnidev tasks complete <id>` - Mark a task as done
*   `omnidev tasks board` - Open interactive task board (OpenTUI)

---

## Demo Scenarios

1.  **Plan → Execute loop (no context bloat)**
    *   Enable `tasks` and `git` capabilities.
    *   Use the `planning` profile to create a plan and tasks.
    *   Switch to `coding` profile, implement, run tests, and checkpoint/rollback as needed.

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

---

## Future Features

*   **Remote Sandboxes**: Execute code in a cloud container for heavy workloads.
*   **Capability Hub**: `omnidev install user/capability`.
*   **Binary Distribution**: Compile to single executable via `bun build --compile`.
