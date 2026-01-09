# OmniDev

> A meta-MCP that eliminates context bloat by exposing only **2 tools** to LLMs while providing unlimited power through a sandboxed coding environment.

## The Core Insight

Most AI agents interact with the world through dozens of MCP tools, bloating context and requiring round-trips for every action. OmniDev takes a different approach:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Traditional MCP Approach                      │
│   LLM Context: [tool1, tool2, tool3, ... tool50]                │
│   Action: Call tool1 → Wait → Result → Call tool2 → Wait...     │
│                  SLOW, BLOATED, FRAGILE                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      OmniDev Approach                            │
│   LLM Context: [omni_query, omni_execute]                       │
│   Action: Write Script → Execute → Done                          │
│                  FAST, PROGRAMMATIC, POWERFUL                   │
└─────────────────────────────────────────────────────────────────┘
```

**Everything is a Capability.** MCPs become code (`aws.*`), workflows become code (`ralph.*`), docs become searchable context—all accessible through two simple tools.

## Features

- **🔧 Two MCP Tools** — `omni_query` for discovery, `omni_execute` for action
- **📦 Capability System** — Extensible plugins for MCPs, workflows, docs, CLI commands
- **🔄 Multi-Provider Sync** — One command generates configs for Claude, Cursor, and more
- **📝 Skills & Rules** — Define agent behaviors and guidelines per capability
- **⚡ Hot Reload** — Server reloads automatically when config changes
- **🎯 Profiles** — Switch capability sets for different workflows (planning vs coding)
- **🤖 Ralph** — Built-in AI agent orchestrator for PRD-driven development

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM / AI Agent                            │
│   Only sees 2 tools: omni_query, omni_execute                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OmniDev Server                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               Capabilities Registry                         │ │
│  │  • Directories in omni/capabilities/                       │ │
│  │  • Code, docs, skills, CLI commands, views                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Execution Environment ("Sandbox")                 │ │
│  │  • Runtime: Bun (TypeScript)                               │ │
│  │  • Modules: Auto-generated from active Capabilities        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (Stricli)                            │
│  • Built-in: init, serve, doctor, agents sync                   │
│  • Capability-contributed commands (e.g., ralph)                │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/omnidev.git
cd omnidev

# Install dependencies
bun install

# Verify setup
bun run check
```

## Quick Start

```bash
# Initialize OmniDev in your project
omnidev init

# Check your setup
omnidev doctor

# List available capabilities
omnidev capability list

# Sync agent configurations
omnidev agents sync

# Start the MCP server
omnidev serve
```

## CLI Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `omnidev init` | Create `.omni/` directory with complete configuration structure |
| `omnidev serve` | Start the MCP server |
| `omnidev doctor` | Check runtime dependencies and validate directory structure |

### Capability Management

| Command | Description |
|---------|-------------|
| `omnidev capability list` | List discovered capabilities with enabled/disabled status |
| `omnidev capability enable <name>` | Enable a capability and update gitignore |
| `omnidev capability disable <name>` | Disable a capability and remove gitignore patterns |

### Profile Management

| Command | Description |
|---------|-------------|
| `omnidev profile list` | List available profiles with active indicator |
| `omnidev profile set <name>` | Switch active profile (auto-syncs) |
| `omnidev profile create <name>` | Create a new profile |

### Agent Sync

| Command | Description |
|---------|-------------|
| `omnidev agents sync` | Sync skills/rules to provider-specific files |
| `omnidev types generate` | Generate `.d.ts` files for enabled capabilities |

### Ralph - AI Agent Orchestrator (built-in capability)

| Command | Description |
|---------|-------------|
| `omnidev ralph init` | Initialize Ralph in project |
| `omnidev ralph start` | Start PRD-driven orchestration |
| `omnidev ralph stop` | Gracefully stop orchestration |
| `omnidev ralph status` | View current PRD and story status |
| `omnidev ralph prd list` | List all PRDs |
| `omnidev ralph prd create <name>` | Create a new PRD |
| `omnidev ralph prd select <name>` | Set active PRD |
| `omnidev ralph story list` | List stories in active PRD |
| `omnidev ralph story pass <id>` | Mark story as passed |

## The Two MCP Tools

### `omni_query`

Discovery and search without dumping tons of context.

```json
{
  "query": "search query",
  "limit": 10,
  "include_types": false
}
```

- Search across capabilities, docs, and skills
- Returns short snippets with source tags
- Returns type definitions when `include_types` is true
- Empty query returns summary of enabled capabilities

### `omni_execute`

Run TypeScript code with access to capability modules.

```json
{
  "code": "full contents of main.ts"
}
```

The LLM writes complete TypeScript files:

```typescript
import * as ralph from 'ralph';
import * as fs from 'fs';

export async function main(): Promise<number> {
  // Get current PRD status
  const prd = await ralph.getPRD('user-auth');
  const nextStory = await ralph.getNextStory('user-auth');
  
  if (nextStory) {
    console.log(`Next story: ${nextStory.title}`);
  }
  
  return 0; // Success
}
```

Response includes `stdout`, `stderr`, `exit_code`, `changed_files`, and `diff_stat`.

## Project Structure

### OmniDev Monorepo

```
omnidev/
├── packages/
│   ├── core/           # Shared types, capability loader, config
│   ├── cli/            # Stricli CLI + commands
│   └── mcp/            # MCP server (omni_query, omni_execute)
├── capabilities/
│   └── ralph/          # Built-in AI agent orchestrator
├── package.json        # Workspace root
├── bunfig.toml         # Bun configuration
└── biome.json          # Linting/formatting
```

### User Project Structure (after `omnidev init`)

```
project-root/
├── AGENTS.md                    # Codex provider instructions (if selected)
├── .claude/
│   └── claude.md                # Claude provider instructions (if selected)
└── .omni/                       # Single OmniDev folder
    ├── .gitignore               # Internal gitignore
    │
    ├── # === Configuration Files === #
    ├── config.toml              # Project name, default profile
    ├── provider.toml            # AI provider selection
    ├── capabilities.toml        # Enabled capabilities
    ├── profiles.toml            # Profile definitions
    ├── active-profile           # Current profile name
    │
    ├── # === Secrets (always ignored) === #
    ├── .env                     # Environment variables
    │
    ├── # === Capabilities === #
    ├── capabilities/            # Custom capability definitions
    │   └── my-capability/
    │       ├── capability.toml
    │       ├── index.ts
    │       ├── skills/
    │       └── rules/
    │
    ├── # === Generated (always ignored) === #
    ├── generated/
    │   └── rules.md             # Aggregated rules for agents
    │
    ├── # === Runtime (always ignored) === #
    ├── state/                   # Capability state storage
    └── sandbox/                 # Sandbox execution
```

### Understanding the `.omni` Folder

OmniDev uses a **single `.omni` folder** for all configuration and working files. An internal `.omni/.gitignore` file controls what gets shared vs ignored, giving you two usage modes:

#### Team Mode (Shared Configuration)

**How:** Commit the `.omni/` folder to your repository.

**What gets shared:**
- Capability definitions and rules
- Enabled capabilities list
- Profile definitions
- Provider selection
- Project configuration

**What stays private:**
- Secrets in `.env`
- Generated files (`generated/`)
- Runtime state (`state/`)
- Sandbox files (`sandbox/`)
- Capability working files (via their gitignore exports)

**Best for:**
- Teams who want consistent AI agent behavior
- Projects with custom capabilities
- Standardized workflows across developers

#### Personal Mode (Private Configuration)

**How:** Add `.omni` to your project's root `.gitignore`.

**What happens:**
- All OmniDev configuration is local to you
- Each developer sets up independently
- No shared capabilities or profiles

**Best for:**
- Personal projects
- Experimentation
- Teams who prefer independence

### Configuration Files

Each configuration file in `.omni/` serves a specific purpose:

| File | Purpose | Created By |
|------|---------|-----------|
| `config.toml` | Project name and default profile | `omnidev init` |
| `provider.toml` | Selected AI provider(s): Claude, Codex, or both | `omnidev init` |
| `capabilities.toml` | Which capabilities are enabled/disabled | `omnidev init`, `omnidev capability enable/disable` |
| `profiles.toml` | Profile definitions with capability overrides | `omnidev init`, `omnidev profile create` |
| `active-profile` | Name of currently active profile | `omnidev profile set` |
| `.gitignore` | Internal gitignore patterns (core + capability-exported) | `omnidev init`, `omnidev capability enable/disable`, `omnidev agents sync` |

All configuration files use TOML format with inline comments explaining their purpose.

### Internal Gitignore Structure

The `.omni/.gitignore` file has two sections:

**1. OmniDev Core (always ignored):**
- `.env` — Secrets
- `generated/` — Generated content
- `state/` — Runtime state
- `sandbox/` — Sandbox execution
- `*.log` — Log files

**2. Capability Patterns (auto-managed):**
- Added when `omnidev capability enable <name>` is run
- Removed when `omnidev capability disable <name>` is run
- Each capability's patterns are grouped under a comment

Example:

```gitignore
# ================================================
# OmniDev Core - Always Ignored
# ================================================

.env
generated/
state/
sandbox/
*.log

# ================================================
# Capability Patterns - Auto-Managed
# ================================================

# ralph capability
work/
*.tmp
progress.txt
```

Capabilities can export gitignore patterns via their `index.ts`:

```typescript
export const gitignore = [
  'work/',
  '*.tmp',
  'progress.txt'
];
```

Run `omnidev agents sync` to rebuild the `.omni/.gitignore` with all enabled capability patterns.

## Capabilities

A capability is a directory in `.omni/capabilities/` containing:

```
.omni/capabilities/my-capability/
├── capability.toml     # Metadata & config (required)
├── definition.md       # Description (required)
├── index.ts            # Exports: tools, CLI commands, views, gitignore
├── types.d.ts          # Type definitions for LLM
├── skills/             # Agent behaviors (SKILL.md files)
├── rules/              # Guidelines (*.md files)
└── docs/               # Documentation for search
```

### capability.toml

```toml
[capability]
id = "ralph"
name = "Ralph Orchestrator"
version = "1.0.0"
description = "AI agent orchestrator for PRD-driven development"

[exports]
module = "ralph"

[env]
# Optional environment requirements
API_KEY = { required = true, secret = true }
LOG_LEVEL = { default = "info" }
```

### Skills vs Rules

| Use Case | Skills | Rules |
|----------|--------|-------|
| Workflow definitions | ✓ | |
| Code style guidelines | | ✓ |
| Tool usage instructions | ✓ | |
| Project constraints | | ✓ |
| Agent behavior patterns | ✓ | |

## Ralph - AI Agent Orchestrator

Ralph is the built-in capability that enables PRD-driven development through iterative AI agent invocations. Each iteration works on one user story until all acceptance criteria are met.

### Key Features

- **Multi-Agent Support** — Works with Claude, Codex, or Amp agents
- **PRD-Driven** — Structured Product Requirements Documents with user stories
- **Progress Tracking** — Maintains progress logs and codebase patterns
- **Auto-Archive** — Completed PRDs are automatically archived

### Ralph State Structure

```
.omni/ralph/
├── config.toml          # Agent configs, iteration settings
├── active-prd           # Currently active PRD name
├── prds/
│   └── <prd-name>/
│       ├── prd.json     # PRD definition with stories
│       ├── progress.txt # Progress log
│       └── specs/       # Detailed spec files
└── completed-prds/      # Archived completed PRDs
```

### Example Workflow

```bash
# Initialize Ralph
omnidev ralph init

# Create a new PRD
omnidev ralph prd create user-auth

# Add specs and stories
omnidev ralph spec create database-schema --prd user-auth
omnidev ralph story add "Database schema" --spec specs/001-database-schema.md

# Start orchestration
omnidev ralph start --prd user-auth --agent claude --iterations 20

# Monitor progress
omnidev ralph status
omnidev ralph log --tail 50
```

## Configuration

### Project Configuration (`.omni/config.toml`)

```toml
# Project Settings
# This file defines the project name and default profile.
# See profiles.toml for profile definitions.
# See capabilities.toml for enabled capabilities.

project = "my-project"
default_profile = "default"
```

### Provider Selection (`.omni/provider.toml`)

```toml
# AI Provider Selection
# Choose which AI providers to support: Claude, Codex, or both.
# This controls which instruction files are generated (AGENTS.md, .claude/claude.md).

claude = true
codex = false
```

### Capabilities (`.omni/capabilities.toml`)

```toml
# Capability State Management
# This file tracks which capabilities are enabled or disabled.
# Use: omnidev capability enable/disable <name>

enabled = ["tasks"]
disabled = []
```

### Profiles (`.omni/profiles.toml`)

```toml
# Profile Definitions
# Profiles allow switching capability sets for different workflows.
# Active profile stored in .omni/active-profile file.

[default]
enable = []
disable = []

[planning]
enable = ["ralph", "research"]
disable = ["git"]

[coding]
enable = ["ralph", "git"]
disable = ["research"]
```

### Secrets (`.omni/.env`)

```bash
# Environment Variables and Secrets
# This file is always gitignored (via .omni/.gitignore)

GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIA...
```

## Development

### Scripts

```bash
bun run check        # typecheck + lint + format
bun run typecheck    # TypeScript only
bun run lint         # Biome lint
bun run format       # Biome format
bun test             # Run tests
bun test --coverage  # With coverage report
```

### Quality Gates

- Pre-commit hooks run typecheck, lint, format, and tests
- 70% code coverage target
- Strict TypeScript (no `any` types)

## Roadmap

### ✅ Completed
- [x] Bun monorepo setup
- [x] Code quality infrastructure (Biome, Lefthook)
- [x] Testing infrastructure
- [x] Core types and configuration
- [x] Capability system (loader, skills, rules, docs)
- [x] CLI package (Stricli)
- [x] MCP server package

### 🚧 In Progress
- [ ] Ralph capability (AI orchestrator)

### 📋 Future
- [ ] TUI views (OpenTUI)
- [ ] Capability hub / remote installation
- [ ] Git safety layer (checkpoints, rollback)
- [ ] Doc indexing and search
- [ ] MCP server wrapping

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh) |
| CLI Framework | [Stricli](https://bloomberg.github.io/stricli/) |
| MCP Server | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) |
| Configuration | TOML ([smol-toml](https://github.com/nicolo-ribaudo/smol-toml)) |
| Linting | [Biome](https://biomejs.dev/) |
| Git Hooks | [Lefthook](https://github.com/evilmartians/lefthook) |

## License

MIT
