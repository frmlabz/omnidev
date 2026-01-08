# OmniDev MVP Specification

> **Status**: MVP v0.2
> **Last Updated**: 2026-01-08

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
- [x] One built-in capability (`tasks`) demonstrating all extension points
- [x] Skills (Agent Skills spec) & Rules (markdown files)
- [x] `omnidev agents sync` - multi-provider agent config generation
- [x] CLI command extension from capabilities
- [x] TUI view extension from capabilities
- [x] Basic profiles (enable/disable capability groupings)
- [x] **Split directory structure** (`omni/` visible, `.omni/` hidden)
- [x] **Environment variables & secrets** (`[env]` in capability.toml, `.omni/.env`)
- [x] **Type definitions generation** (`.d.ts` for `omni_query`)

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
- Extract and register: `tools` (sandbox), `cliCommands`, `cliViews`
- Discover: `skills/`, `rules/`, `docs/`
- Load environment from `.omni/.env` and process env

**Type Generator:**
- Generate `.d.ts` files from capability exports
- Write to `.omni/types/capabilities.d.ts`
- Include in `omni_query` response when `include_types: true`

**Types:**
- `CapabilityConfig` (parsed from TOML)
- `CapabilityExports` (what `index.ts` exports)
- `CommandDefinition` (Stricli-compatible command shape)
- `McpToolDefinition` (MCP SDK-compatible tool shape)
- `Skill` (Agent Skills spec)
- `Rule` (profile-aware rules)
- `EnvDeclaration` (environment variable requirements)

### 4. Built-in Capability: `tasks`

Demonstrates all extension points:

| Feature | Implementation |
|---------|----------------|
| **Sandbox Tools** | `create`, `list`, `get`, `update`, `complete`, `planGet`, `planSet` |
| **CLI Commands** | `omnidev tasks list`, `add`, `show`, `start`, `complete`, `block`, `board` |
| **TUI Views** | `TaskListView`, `TaskBoardView`, `TaskDetailView` |
| **Skills** | `task-management` skill in `skills/` |
| **Rules** | `task-workflow.md` in `rules/` |

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

One command that does everything:

1. **Reads enabled capabilities** from config (based on active profile)
2. **Collects** skills + rules from all enabled capabilities
3. **Generates provider-specific files:**

| Provider | Output Files |
|----------|--------------|
| Generic | `agents.md` (repo root) |
| Claude Code | `.claude/claude.md` + symlink `.claude/skills/` |
| Cursor | `.cursor/rules/` directory |

4. **Creates symlinks** to skill directories where needed

**Example Output Structure:**
```
project-root/
├── agents.md                    # Generic agent config
├── .claude/
│   ├── claude.md                # Claude Code specific
│   └── skills/                  # Symlinks to omni/capabilities/*/skills/
├── .cursor/
│   └── rules/
│       └── omnidev.mdc          # Cursor rules file
├── omni/                        # Visible, COMMITTED
│   ├── config.toml
│   └── capabilities/
└── .omni/                       # Hidden, GITIGNORED
    ├── config.local.toml
    ├── .env
    ├── state/
    └── types/
        └── capabilities.d.ts    # Generated type definitions
```

---

## Skills & Rules System

### Skills (from `skills/*/SKILL.md`)

Skills are agent behaviors that follow the Agent Skills spec:

```markdown
---
name: task-management
description: Maintain an explicit plan and update tasks as work progresses.
---

## Instructions

- Maintain an explicit plan before executing multi-step work.
- Keep exactly one plan step `in_progress` at a time.
...
```

### Rules (from `rules/*.md`)

Rules are simple markdown files with guidelines or constraints:

```markdown
<!-- rules/task-workflow.md -->

# Task Workflow Rules

- Always check the current task list before starting new work
- Keep exactly one task `in_progress` at a time
- Update task status as you make progress
- When blocked, mark the task as `blocked` and explain why
```

### Profiles

Profiles are **user-created groupings** to enable/disable capabilities. They're project-specific settings defined in `config.toml`:

```toml
# omni/config.toml (COMMITTED)
default_profile = "default"

[capabilities]
enable = ["tasks", "git"]

[env]
# Team defaults (non-secret)
AWS_REGION = "eu-west-1"

[profiles.frontend]
enable = ["tasks", "git", "react-rules"]
disable = []

[profiles.backend]
enable = ["tasks", "git", "api-rules"]
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
│   └── tasks/                      # Built-in tasks capability
│       ├── capability.toml
│       ├── definition.md
│       ├── index.ts
│       ├── tools/
│       │   └── taskManager.ts
│       ├── cli/
│       │   ├── commands.ts
│       │   └── views/
│       │       ├── TaskList.tsx
│       │       └── TaskBoard.tsx
│       ├── rules/
│       │   └── task-workflow.md    # Simple markdown rules
│       └── skills/
│           └── task-management/
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
├── omni/                           # VISIBLE, COMMITTED
│   ├── config.toml                 # Team config, enabled capabilities
│   ├── capabilities/               # Project-specific capabilities
│   │   └── tasks/
│   │       └── ...
│   └── profiles/                   # Optional profile definitions
│
├── .omni/                          # HIDDEN, GITIGNORED
│   ├── config.local.toml           # Personal overrides
│   ├── .env                        # Secrets (API keys, tokens)
│   ├── state/                      # Runtime state (task DB, etc.)
│   ├── sandbox/                    # Code execution scratch
│   └── types/                      # Generated type definitions
│       └── capabilities.d.ts
│
└── .gitignore                      # Must include: .omni/
```

---

## Technical Implementation

### Capability Loading Flow

```
1. CLI/MCP starts
2. Read omni/config.toml + .omni/config.local.toml, merge, get active profile
3. Load environment from .omni/.env + process.env
4. Discover omni/capabilities/*/capability.toml
5. For each capability:
   a. Parse capability.toml → CapabilityConfig (incl. [env] declarations)
   b. Validate required env vars are present
   c. await import(`${capPath}/index.ts`) → CapabilityExports
   d. Register:
      - cliCommands → Stricli app
      - cliViews → View registry
      - tools → Sandbox namespace
      - skills → Skills registry  
      - rules → Rules registry
6. Generate type definitions → .omni/types/capabilities.d.ts
7. Ready to serve
```

### Agent Sync Implementation

```typescript
// packages/cli/src/commands/agents.ts
import { 
  getEnabledCapabilities,
  getAllSkills, 
  getAllRules,
  generateGenericConfig,
  generateClaudeConfig,
  generateCursorConfig,
} from '@omnidev/core';

interface SyncOptions {
  providers?: ('generic' | 'claude' | 'cursor')[];
}

export async function syncAgents(options: SyncOptions = {}) {
  const providers = options.providers ?? ['generic', 'claude', 'cursor'];
  
  // Get enabled capabilities (based on active profile)
  const capabilities = await getEnabledCapabilities();
  
  // Gather content from enabled capabilities
  const skills = await getAllSkills(capabilities);
  const rules = await getAllRules(capabilities);
  
  const context = { skills, rules, capabilities };
  
  // Generate for each provider
  const results: string[] = [];
  
  if (providers.includes('generic')) {
    await generateGenericConfig(context);
    results.push('agents.md');
  }
  
  if (providers.includes('claude')) {
    await generateClaudeConfig(context);
    results.push('.claude/claude.md');
  }
  
  if (providers.includes('cursor')) {
    await generateCursorConfig(context);
    results.push('.cursor/rules/omnidev.mdc');
  }
  
  console.log(`✓ Synced agent config:`);
  results.forEach(f => console.log(`  - ${f}`));
}
```

### Provider Generators

```typescript
// packages/core/src/providers/claude.ts
import { mkdir, symlink } from 'fs/promises';
import { join } from 'path';

export async function generateClaudeConfig(context: AgentContext) {
  const { skills, rules } = context;
  
  // Ensure .claude directory exists
  await mkdir('.claude', { recursive: true });
  
  // Generate claude.md
  let content = `# Claude Code Configuration

> Generated by OmniDev
> Run \`omnidev agents sync\` to regenerate

## Skills

`;

  for (const skill of skills) {
    content += `### ${skill.name}\n\n${skill.content}\n\n`;
  }

  content += `## Rules\n\n`;
  
  for (const rule of rules) {
    content += `### ${rule.name}\n\n${rule.content}\n\n`;
  }

  await Bun.write('.claude/claude.md', content);
  
  // Create symlinks to skill directories (if Claude supports it)
  // This allows Claude to discover skills in their native format
  const skillsDir = '.claude/skills';
  await mkdir(skillsDir, { recursive: true });
  
  // Symlink each capability's skills directory
  // Note: omni/ is visible and committed, symlinks point there
  for (const skill of skills) {
    const target = join('../omni/capabilities', skill.capabilityId, 'skills');
    const link = join(skillsDir, skill.capabilityId);
    try {
      await symlink(target, link);
    } catch (e) {
      // Link may already exist
    }
  }
}
```

### Environment Loading

```typescript
// packages/core/src/capability/env.ts
import { join } from 'path';

export interface EnvDeclaration {
  required?: boolean;
  secret?: boolean;
  default?: string;
}

export interface EnvConfig {
  [key: string]: EnvDeclaration | Record<string, never>;
}

export async function loadEnvironment(omniLocalDir: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  
  // 1. Load from .omni/.env
  const envPath = join(omniLocalDir, '.env');
  try {
    const content = await Bun.file(envPath).text();
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        env[key] = valueParts.join('=');
      }
    }
  } catch {
    // No .env file
  }
  
  // 2. Process env overrides .env file
  Object.assign(env, process.env);
  
  return env;
}

export function validateEnv(
  declarations: EnvConfig,
  env: Record<string, string | undefined>,
  capabilityId: string
): void {
  for (const [key, decl] of Object.entries(declarations)) {
    const value = env[key] ?? (decl as EnvDeclaration).default;
    
    if ((decl as EnvDeclaration).required && !value) {
      throw new Error(
        `Missing required env var ${key} for capability "${capabilityId}". ` +
        `Set it in .omni/.env or process environment.`
      );
    }
  }
}
```

### Type Definitions Generator

```typescript
// packages/core/src/capability/typegen.ts
import { join } from 'path';

export async function generateTypeDefinitions(
  capabilities: LoadedCapability[],
  outputDir: string
): Promise<string> {
  let dts = `// Auto-generated type definitions for enabled capabilities\n`;
  dts += `// Generated by: omnidev types generate\n\n`;
  
  for (const cap of capabilities) {
    const moduleName = cap.config.exports?.module ?? cap.config.capability.id;
    
    dts += `declare module '${moduleName}' {\n`;
    
    // Extract type information from capability exports
    // For MVP: use JSDoc comments or manual .d.ts files in capabilities
    if (cap.typeDefinitions) {
      dts += cap.typeDefinitions;
    } else {
      dts += `  // Type definitions not available for this capability\n`;
      dts += `  // Add a types.d.ts file to omni/capabilities/${cap.config.capability.id}/\n`;
    }
    
    dts += `}\n\n`;
  }
  
  const outputPath = join(outputDir, 'capabilities.d.ts');
  await Bun.write(outputPath, dts);
  
  return dts;
}
```

### Rules Loading

```typescript
// packages/core/src/capability/rules.ts

export interface Rule {
  /** Filename (e.g., "task-workflow.md") */
  filename: string;
  
  /** The rule content (markdown) */
  content: string;
  
  /** Which capability this rule belongs to */
  capabilityId: string;
}

export async function loadRules(capabilityPath: string): Promise<Rule[]> {
  const rulesDir = join(capabilityPath, 'rules');
  const rules: Rule[] = [];
  
  try {
    for await (const entry of new Bun.Glob('*.md').scan(rulesDir)) {
      const rulePath = join(rulesDir, entry);
      const content = await Bun.file(rulePath).text();
      rules.push({
        filename: entry,
        content,
        capabilityId: basename(capabilityPath),
      });
    }
  } catch {
    // No rules directory
  }
  
  return rules;
}
```

---

## Success Criteria

### CLI Works
- [ ] `omnidev init` creates `omni/` and `.omni/` directories
- [ ] `omnidev doctor` reports Bun version and status
- [ ] `omnidev capability list` shows `tasks` capability
- [ ] `omnidev profile list` shows available profiles
- [ ] `omnidev profile set <name>` switches profile
- [ ] `omnidev tasks list` shows task list (empty initially)
- [ ] `omnidev tasks add "Test task"` creates a task
- [ ] `omnidev tasks board` opens interactive TUI

### MCP Server Works
- [ ] `omnidev serve` starts MCP server on stdio
- [ ] MCP client can call `omni_capabilities` and get response
- [ ] MCP client can call `tasks_create` and create a task
- [ ] MCP client can call `tasks_list` and see tasks

### Agent Sync Works
- [ ] `omnidev agents sync` generates `agents.md`
- [ ] `omnidev agents sync` generates `.claude/claude.md`
- [ ] `omnidev agents sync` generates `.cursor/rules/omnidev.mdc`
- [ ] Generated files include skills from enabled capabilities
- [ ] Generated files include rules from enabled capabilities
- [ ] Switching profile changes which capabilities are enabled
- [ ] Re-running sync after profile switch produces different output

### Directory Split Works
- [ ] `omni/` is created and committed (visible)
- [ ] `.omni/` is created and gitignored (hidden)
- [ ] `omni/config.toml` contains team settings
- [ ] `.omni/config.local.toml` contains personal overrides
- [ ] Settings from local config override team config

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

## Development Phases

### Phase 1: Scaffolding (Day 1-2)
- [ ] Set up monorepo with Bun workspaces
- [ ] Create package structure
- [ ] Basic Stricli CLI with `init` and `doctor`
- [ ] Basic MCP server that starts
- [ ] **Directory structure: `omni/` + `.omni/` split**

### Phase 2: Capability System (Day 3-4)
- [ ] Capability loader (discover, parse, import)
- [ ] Type definitions
- [ ] Register CLI commands from capabilities
- [ ] Register sandbox tools from capabilities
- [ ] **Environment loading (`.omni/.env` + process env)**
- [ ] **Env validation (`[env]` in capability.toml)**

### Phase 3: Tasks Capability (Day 5-6)
- [ ] Task manager implementation (sandbox tools)
- [ ] CLI commands
- [ ] OpenTUI views (TaskList, TaskBoard, TaskDetail)
- [ ] Skills + Rules
- [ ] **Type definitions file (`types.d.ts`)**

### Phase 4: Agent Sync & Profiles (Day 7)
- [ ] Profile management (list, set)
- [ ] Skills loader
- [ ] Rules loader (profile-aware)
- [ ] Provider generators (generic, claude, cursor)
- [ ] `agents sync` command
- [ ] **Config merging (team + local)**

### Phase 5: Type Generation (Day 8)
- [ ] Type definitions generator
- [ ] `omnidev types generate` command
- [ ] Integration with `omni_query` (`include_types`)

### Phase 6: Polish & Test (Day 9)
- [ ] End-to-end testing
- [ ] Error handling (especially env/secrets)
- [ ] Documentation
- [ ] Demo recording

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

## Open Questions

1. **Stricli + OpenTUI integration**: How exactly do we render TUI after a command runs? Need to verify the integration pattern.

2. **Hot reload**: For MVP, do we restart the server when capabilities change, or implement basic hot reload?

3. **Cursor format**: What exact format does Cursor expect for its rules? Need to verify `.cursor/rules/*.mdc` format.

4. **Claude symlinks**: Does Claude Code actually follow symlinks for skills discovery, or do we need to copy files?

---

## Notes

- Keep it simple. The goal is to prove the architecture, not build everything.
- Focus on the happy path. Error handling can be improved later.
- Document as we go. The MVP is also a learning exercise.
- The `agents sync` command is the key differentiator - one command, all providers.
