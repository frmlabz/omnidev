# OmniDev MVP Specification

> **Status**: MVP v0.3
> **Last Updated**: 2026-01-09

## Goal

Validate the core architecture by building a minimal but functional system that proves:
1. The tech stack works together (Bun + Stricli + OpenTUI + MCP SDK)
2. Capabilities can extend both the MCP and CLI
3. The system can generate/manage AI agent configuration files for multiple providers

---

## MVP Scope

### What's IN

- [x] Basic CLI scaffolding with Stricli
- [x] Basic MCP server with the SDK
- [x] Capability loader (dynamic `import()`)
- [x] One built-in capability (`ralph`) demonstrating all extension points
- [x] Skills (Agent Skills spec) & Rules (markdown files)
- [x] `omnidev agents sync` - multi-provider agent config generation
- [x] CLI command extension from capabilities
- [x] TUI view extension from capabilities
- [x] Basic profiles (enable/disable capability groupings)
- [x] **Split directory structure** (`omni/` visible, `.omni/` hidden)
- [x] **Environment variables & secrets** (`[env]` in capability.toml, `.omni/.env`)
- [x] **Type definitions generation** (`.d.ts` for `omni_query`)
- [x] **Reference pattern** - committed files reference gitignored generated content
- [x] **Hot reload** - MCP server reloads on config/capability changes
- [x] **Auto-sync on profile switch** - `omnidev profile set` triggers `agents sync`
- [x] **Bun Workspaces** - capabilities as packages, shared dependencies
- [x] **Symlinked sandbox** - capabilities linked into `.omni/sandbox/node_modules/`

### What's OUT (Future)

- Config layering (global → project → local) - *basic local overrides IN, full layering OUT*
- MCP server wrapping (the `[mcp]` block in capability.toml)
- Doc indexing and `omni_query` search
- Git safety layer (checkpoints, rollback)
- Sandbox execution (`omni_execute`)
- Capability hub / remote installation

---

## Deliverables

### 1. CLI (`packages/cli`)

**Built-in Commands:**

| Command | Description |
|---------|-------------|
| `omnidev init` | Create `omni/` and `.omni/` directories with starter config |
| `omnidev serve` | Start the MCP server |
| `omnidev capability list` | List discovered capabilities |
| `omnidev agents sync` | Sync skills/rules to provider-specific files |
| `omnidev profile list` | List available profiles |
| `omnidev profile set <name>` | Switch active profile |
| `omnidev doctor` | Check runtime dependencies (Bun version, etc.) |
| `omnidev types generate` | Generate `.d.ts` files for enabled capabilities |

**Extension Points:**
- Capabilities can register commands under `omnidev <capability-id> <command>`
- Commands can specify a TUI view to render results

### 2. MCP Server (`packages/mcp`)

**The MCP exposes exactly 2 tools:**

| Tool | Description |
|------|-------------|
| `omni_query` | Search capabilities, docs, skills |
| `omni_execute` | Run TypeScript code in the sandbox |

Capabilities **do not add MCP tools**. Instead, they add functions to the sandbox that LLMs can call by writing code via `omni_execute`.

### 3. Core (`packages/core`)

**Capability Loader:**
- Discover capabilities in `omni/capabilities/`
- Parse `capability.toml` for metadata (including `[env]` declarations)
- Dynamic `import()` of `index.ts`
- Extract programmatic exports (takes precedence): `skills`, `rules`, `docs`, `typeDefinitions`
- Fallback to filesystem discovery: `skills/*/SKILL.md`, `rules/*.md`, `docs/*.md`, `types.d.ts`
- Register: `tools` (sandbox), `cliCommands`, `cliViews`
- Load environment from `.omni/.env` and process env

**Type Generator:**
- Use `typeDefinitions` export if available
- Otherwise generate from `types.d.ts` file
- Write combined types to `.omni/generated/types.d.ts`
- Include in `omni_query` response when `include_types: true`

**Types:**

```typescript
// Skill - agent behavior instruction
interface Skill {
  name: string;           // 1-64 chars, lowercase, hyphens ok
  description: string;    // 1-1024 chars
  instructions: string;   // Markdown content
}

// Rule - guideline or constraint
interface Rule {
  name: string;           // Identifier
  content: string;        // Markdown content
}

// Doc - documentation/knowledge
interface Doc {
  name: string;           // Identifier
  content: string;        // Markdown content
}

// CapabilityExports - what index.ts can export
interface CapabilityExports {
  // Programmatic (optional, takes precedence over filesystem)
  skills?: Skill[];
  rules?: Rule[];
  docs?: Doc[];
  getDocs?: () => Promise<Doc[]>;  // Async docs (fetch from API, etc.)
  typeDefinitions?: string;
  
  // Required
  cliCommands?: Record<string, CommandDefinition>;
  cliViews?: Record<string, string>;
  // Plus named function exports for sandbox tools
}
```

### 4. Built-in Capability: `ralph`

Ralph is the AI agent orchestrator capability that demonstrates all extension points:

| Feature | Implementation |
|---------|----------------|
| **Sandbox Tools** | `listPRDs`, `getPRD`, `createPRD`, `getNextStory`, `markStoryPassed`, `appendProgress` |
| **CLI Commands** | `omnidev ralph init`, `start`, `stop`, `status`, `prd`, `story`, `spec`, `log` |
| **TUI Views** | `StatusView`, `PRDListView`, `StoryListView` |
| **Skills** | `prd-creation`, `ralph-orchestration` skills in `skills/` |
| **Rules** | `prd-structure.md`, `iteration-workflow.md` in `rules/` |

### 5. Skills, Rules & Agent Sync

**Skills:**
- Read `skills/*/SKILL.md` from capabilities
- Skills follow the [Agent Skills spec](https://github.com/anthropics/agent-skills)
- Compatible with Cursor and Claude

**Rules:**
- Read `rules/*.md` from capabilities
- Simple markdown files with guidelines, constraints, or instructions
- Included when the capability is enabled

**`omnidev agents sync` Command:**

One command that generates all profile-dependent content:

1. **Reads enabled capabilities** from config (based on active profile)
2. **Collects** skills + rules from all enabled capabilities
3. **Generates to `.omni/generated/`** (gitignored):

| Output | Contents |
|--------|----------|
| `.omni/generated/rules.md` | Compiled rules from enabled capabilities |
| `.omni/generated/skills.md` | Compiled skills from enabled capabilities |
| `.omni/generated/types.d.ts` | Type definitions for `omni_query` |
| `.omni/generated/cursor-rules.md` | Cursor-specific format |

**Skills go directly to provider locations** (where they're discovered):
- `.claude/skills/` - Claude Code discovers skills here
- `.cursor/rules/omnidev-*.mdc` - Cursor discovers rules here

These directories are **gitignored** since they're profile-dependent.

**`omnidev profile set <name>` Command:**

Switches profile and auto-syncs:
1. Writes profile name to `.omni/active-profile`
2. Runs `agents sync` automatically
3. Notifies running MCP server to reload

**Example Output Structure:**
```
project-root/
├── agents.md                    # COMMITTED (static reference)
├── .claude/
│   ├── claude.md                # COMMITTED (static reference)
│   └── skills/                  # GITIGNORED (generated here)
│       ├── prd-creation/
│       │   └── SKILL.md
│       └── ralph-orchestration/
│           └── SKILL.md
├── .cursor/
│   └── rules/
│       └── omnidev-ralph.mdc    # GITIGNORED (generated here)
├── omni/                        # COMMITTED
│   ├── config.toml
│   └── capabilities/
└── .omni/                       # GITIGNORED
    ├── config.local.toml
    ├── .env
    ├── active-profile           # Current profile name
    ├── generated/               # Other generated content
    │   ├── rules.md
    │   └── types.d.ts
    ├── ralph/                   # Ralph PRDs and state
    ├── state/
    └── server.pid               # For hot reload signals
```

**Gitignore entries** (added by `omnidev init`):
```gitignore
.omni/
.claude/skills/
.cursor/rules/omnidev-*.mdc
```

**Why?** Profile switching only changes gitignored directories — git stays clean.

---

## Skills & Rules System

### Skills (from `skills/*/SKILL.md`)

Skills are agent behaviors that follow the Agent Skills spec:

```markdown
---
name: prd-creation
description: Generate structured PRDs for AI-driven development workflows.
---

## Instructions

- Ask clarifying questions before generating PRD
- Create structured user stories with acceptance criteria
- Link stories to spec files for detailed context
...
```

### Rules (from `rules/*.md`)

Rules are simple markdown files with guidelines or constraints:

```markdown
<!-- rules/prd-structure.md -->

# PRD Structure Rules

- Each PRD must have a unique name
- Stories must have acceptance criteria
- Specs must be linked from stories
- Progress must be logged after each iteration
```

### Profiles

Profiles are **user-created groupings** to enable/disable capabilities. They're project-specific settings defined in `config.toml`:

```toml
# omni/config.toml (COMMITTED)
default_profile = "default"

[capabilities]
enable = ["ralph", "git"]

[env]
# Team defaults (non-secret)
AWS_REGION = "eu-west-1"

[profiles.frontend]
enable = ["ralph", "git", "react-rules"]
disable = []

[profiles.backend]
enable = ["ralph", "git", "api-rules"]
disable = ["react-rules"]
```

```toml
# .omni/config.local.toml (GITIGNORED)
[capabilities]
enable = ["my-debug-tools"]  # Personal additions

[env]
AWS_PROFILE = "nikola-dev"   # Personal override
```

```bash
# .omni/.env (GITIGNORED - secrets)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIA...
```

Profiles don't change what's inside capabilities—they just control which capabilities are active. When you switch profiles, different capabilities (with their skills + rules) become available.

---

## Directory Structure (MVP)

### OmniDev Monorepo

```
omnidev/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── capability/
│   │   │   │   ├── loader.ts       # Discover & load capabilities
│   │   │   │   ├── skills.ts       # Skills loading (skills/*/SKILL.md)
│   │   │   │   ├── rules.ts        # Rules loading (rules/*.md)
│   │   │   │   ├── env.ts          # Environment & secrets loading
│   │   │   │   ├── typegen.ts      # Type definitions generator
│   │   │   │   └── types.ts        # Capability interfaces
│   │   │   ├── config/
│   │   │   │   ├── parser.ts       # TOML parsing (basic)
│   │   │   │   └── profiles.ts     # Profile management (enable/disable caps)
│   │   │   ├── providers/          # Provider-specific generators
│   │   │   │   ├── generic.ts      # agents.md
│   │   │   │   ├── claude.ts       # .claude/claude.md
│   │   │   │   └── cursor.ts       # .cursor/rules/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── init.ts
│   │   │   │   ├── serve.ts
│   │   │   │   ├── capability.ts
│   │   │   │   ├── agents.ts       # agents sync command
│   │   │   │   ├── profile.ts      # profile list/set
│   │   │   │   ├── types.ts        # types generate command
│   │   │   │   ├── ralph.ts        # ralph subcommands
│   │   │   │   └── doctor.ts
│   │   │   ├── app.ts              # Stricli app setup
│   │   │   └── index.ts            # Entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mcp/
│       ├── src/
│       │   ├── server.ts           # MCP server setup
│       │   ├── tools/
│       │   │   └── capabilities.ts # omni_capabilities tool
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── capabilities/
│   └── ralph/                      # Built-in Ralph capability
│       ├── capability.toml
│       ├── definition.md
│       ├── index.ts
│       ├── types.d.ts
│       ├── state.ts                # PRD/story state management
│       ├── orchestrator.ts         # Agent orchestration
│       ├── prompt.ts               # Prompt generation
│       ├── rules/
│       │   ├── prd-structure.md
│       │   └── iteration-workflow.md
│       └── skills/
│           ├── prd-creation/
│           │   └── SKILL.md
│           └── ralph-orchestration/
│               └── SKILL.md
│
├── package.json                    # Workspace root
├── bunfig.toml
├── tsconfig.json
└── biome.json                      # Linting/formatting
```

### User Project Structure

```
project-root/
├── agents.md                       # COMMITTED (reference file)
├── .claude/
│   ├── claude.md                   # COMMITTED (reference file)
│   └── skills/                     # GITIGNORED (skills generated here)
│       ├── prd-creation/
│       │   └── SKILL.md
│       └── ralph-orchestration/
│           └── SKILL.md
├── .cursor/
│   └── rules/
│       └── omnidev-ralph.mdc       # GITIGNORED (rules generated here)
│
├── omni/                           # VISIBLE, COMMITTED
│   ├── config.toml                 # Team config, profiles, enabled caps
│   ├── capabilities/               # Project-specific capabilities
│   │   └── ralph/
│   │       └── ...
│   └── profiles/                   # Optional profile definitions
│
├── .omni/                          # HIDDEN, GITIGNORED
│   ├── config.local.toml           # Personal overrides
│   ├── .env                        # Secrets (API keys, tokens)
│   ├── active-profile              # Current profile name
│   ├── generated/                  # Other generated content
│   │   ├── rules.md                # Compiled rules
│   │   └── types.d.ts              # Type definitions
│   ├── ralph/                      # Ralph state
│   │   ├── config.toml
│   │   ├── active-prd
│   │   └── prds/
│   ├── state/                      # Runtime state
│   ├── sandbox/                    # Code execution scratch
│   └── server.pid                  # For hot reload signals
│
└── .gitignore                      # .omni/, .claude/skills/, .cursor/rules/omnidev-*
```

**Key insight**: Skills go directly to provider locations (gitignored). Profile switching only modifies gitignored directories — git stays clean.

---

## Success Criteria

### CLI Works
- [ ] `omnidev init` creates `omni/` and `.omni/` directories
- [ ] `omnidev doctor` reports Bun version and status
- [ ] `omnidev capability list` shows `ralph` capability
- [ ] `omnidev profile list` shows available profiles
- [ ] `omnidev profile set <name>` switches profile
- [ ] `omnidev ralph init` initializes Ralph structure
- [ ] `omnidev ralph prd create <name>` creates a PRD
- [ ] `omnidev ralph start` begins orchestration

### MCP Server Works
- [ ] `omnidev serve` starts MCP server on stdio
- [ ] MCP client can call `omni_capabilities` and get response
- [ ] MCP client can call `ralph.getPRD` and get PRD
- [ ] MCP client can call `ralph.getNextStory` and get story

### Agent Sync Works
- [ ] `omnidev agents sync` generates `.omni/generated/rules.md`
- [ ] `omnidev agents sync` generates `.omni/generated/skills.md`
- [ ] `omnidev agents sync` generates `.omni/generated/types.d.ts`
- [ ] Generated files include skills from enabled capabilities
- [ ] Generated files include rules from enabled capabilities
- [ ] Switching profile changes which capabilities are enabled
- [ ] Re-running sync after profile switch produces different output
- [ ] **Git stays clean** - only `.omni/` changes on profile switch

### Reference Files Work
- [ ] `omnidev init` creates `agents.md` with reference to `.omni/generated/`
- [ ] `omnidev init` creates `.claude/claude.md` with reference
- [ ] `omnidev init` creates `.cursor/rules/omnidev.mdc` with reference
- [ ] Reference files are committed once, rarely change

### Directory Split Works
- [ ] `omni/` is created and committed (visible)
- [ ] `.omni/` is created and gitignored (hidden)
- [ ] `omni/config.toml` contains team settings
- [ ] `.omni/config.local.toml` contains personal overrides
- [ ] Settings from local config override team config
- [ ] `.omni/active-profile` stores current profile name
- [ ] `.omni/generated/` contains all generated content

### Hot Reload Works
- [ ] MCP server watches config files for changes
- [ ] `omnidev profile set` writes `.omni/active-profile`
- [ ] `omnidev profile set` auto-runs `agents sync`
- [ ] `omnidev profile set` notifies running server to reload
- [ ] Server reloads capabilities when config changes

### Environment & Secrets Work
- [ ] `.omni/.env` file is loaded at startup
- [ ] `[env]` declarations in capability.toml are validated
- [ ] Missing required env vars fail fast with clear error
- [ ] Secret values are masked in logs
- [ ] Process env overrides .env file values

### Type Definitions Work
- [ ] `omnidev types generate` creates `.omni/types/capabilities.d.ts`
- [ ] Type definitions include all enabled capability exports
- [ ] `omni_query` with `include_types: true` returns type definitions

### Extension Points Work
- [ ] Custom capability can add sandbox tools
- [ ] Custom capability can add CLI command
- [ ] Custom capability can add TUI view
- [ ] Custom capability can add skill (`skills/*/SKILL.md`)
- [ ] Custom capability can add rules (`rules/*.md`)
- [ ] Custom capability can declare env vars (`[env]` in capability.toml)

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@stricli/core": "^1.0.0",
    "@opentui/core": "^0.1.0",
    "@opentui/react": "^0.1.0",
    "react": "^18.0.0",
    "smol-toml": "^1.0.0",
    "yaml": "^2.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

> **Note**: Bun has built-in `.env` file loading, so no additional dependency needed. We parse it manually for more control over which variables are exposed to capabilities.

---

## Notes

- Keep it simple. The goal is to prove the architecture, not build everything.
- Focus on the happy path. Error handling can be improved later.
- Document as we go. The MVP is also a learning exercise.
- The `agents sync` command is the key differentiator - one command, all providers.
- Ralph demonstrates the full capability pattern - skills, rules, CLI, sandbox tools.
