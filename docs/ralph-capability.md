# Ralph Capability - Planning Document

## Overview

Ralph is an AI agent orchestrator capability for OmniDev. It enables long-running, PRD-driven development through iterative AI agent invocations. Each iteration works on one user story until all acceptance criteria are met.

Instead of being a standalone script, Ralph integrates as a first-class OmniDev capability with CLI commands, sync hooks, and proper state management.

---

## Goals

1. **CLI Integration** - Access Ralph via `omnidev ralph <subcommand>`
2. **Capability Architecture** - Follow OmniDev capability patterns (sync hooks, skills, rules, types)
3. **Multi-Agent Support** - Orchestrate Claude, Codex, or other CLI agents
4. **Organized State** - Keep PRDs, specs, and progress in `.omni/state/ralph/`
5. **Lifecycle Management** - Track active vs completed work, auto-cleanup

---

## Directory Structure

```
.omni/
├── ralph/
│   ├── config.toml          # Ralph configuration (default agent, iterations, etc.)
│   ├── active-prd           # File containing name of currently active PRD
│   ├── prds/
│   │   ├── user-auth/
│   │   │   ├── prd.json           # PRD definition (stories, branch, progress)
│   │   │   ├── progress.txt       # Progress log with learnings
│   │   │   └── specs/
│   │   │       ├── 001-database-schema.md
│   │   │       ├── 002-api-endpoints.md
│   │   │       └── 003-frontend-ui.md
│   │   └── meal-planner/
│   │       ├── prd.json
│   │       ├── progress.txt
│   │       └── specs/
│   │           └── 001-full-feature.md
│   └── completed-prds/
│       └── 2026-01-09-onboarding/    # Archived completed PRDs
│           ├── prd.json
│           ├── progress.txt
│           └── specs/
│               └── ...
```

### Key Files

#### `.omni/state/ralph/config.toml`
```toml
[ralph]
default_agent = "claude"      # claude, codex, amp
default_iterations = 10
auto_archive = true           # Archive PRDs when all stories pass

[agents.claude]
command = "npx -y @anthropic-ai/claude-code"
args = ["--model", "sonnet", "--dangerously-skip-permissions", "-p"]

[agents.codex]
command = "npx -y @openai/codex"
args = ["exec", "-c", "shell_environment_policy.inherit=all", "--dangerously-bypass-approvals-and-sandbox", "-"]

[agents.amp]
command = "amp"
args = ["--dangerously-allow-all"]
```

#### `.omni/state/ralph/active-prd`
```
user-auth
```

#### PRD Structure: `.omni/state/ralph/prds/<name>/prd.json`
```json
{
  "name": "user-auth",
  "branchName": "ralph/user-auth",
  "description": "User authentication system with login, signup, and password reset",
  "createdAt": "2026-01-09T10:00:00Z",
  "userStories": [
    {
      "id": "US-001",
      "title": "Database schema for users",
      "specFile": "specs/001-database-schema.md",
      "scope": "Full spec",
      "acceptanceCriteria": [
        "Users table created with required columns",
        "Migration runs successfully",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002", 
      "title": "Auth API endpoints",
      "specFile": "specs/002-api-endpoints.md",
      "scope": "Login and signup endpoints only",
      "acceptanceCriteria": [
        "POST /auth/login returns JWT",
        "POST /auth/signup creates user",
        "Typecheck passes"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## CLI Commands

### Core Commands

```bash
# Initialize Ralph in project (creates .omni/state/ralph/ structure)
omnidev ralph init

# Start orchestration for active PRD
omnidev ralph start [--agent <agent>] [--iterations <n>] [--prd <name>]

# Stop running orchestration (graceful shutdown)
omnidev ralph stop

# View status of PRDs and stories
omnidev ralph status [--prd <name>]
```

### PRD Management

```bash
# List all PRDs (active and completed)
omnidev ralph prd list [--all]

# Create new PRD (interactive or from file)
omnidev ralph prd create <name> [--from <spec-file>]

# Set active PRD
omnidev ralph prd select <name>

# View PRD details
omnidev ralph prd view <name>

# Archive completed PRD to completed-prds/
omnidev ralph prd archive <name>

# Delete PRD (with confirmation)
omnidev ralph prd delete <name>
```

### Story Management

```bash
# List stories in active PRD
omnidev ralph story list [--prd <name>]

# Mark story as passed (manual override)
omnidev ralph story pass <story-id> [--prd <name>]

# Mark story as failed (reset to false)
omnidev ralph story reset <story-id> [--prd <name>]

# Add story to PRD
omnidev ralph story add <title> --spec <spec-file> [--prd <name>]
```

### Spec Management

```bash
# List specs in a PRD
omnidev ralph spec list [--prd <name>]

# Create new spec (opens editor or uses template)
omnidev ralph spec create <name> [--prd <name>] [--template <template>]

# View spec content
omnidev ralph spec view <spec-name> [--prd <name>]
```

### Utility Commands

```bash
# View progress log
omnidev ralph log [--prd <name>] [--tail <n>]

# Clear progress log (with confirmation)
omnidev ralph log clear [--prd <name>]

# View codebase patterns from progress
omnidev ralph patterns [--prd <name>]

# Clean up completed PRDs older than N days
omnidev ralph cleanup [--older-than <days>]
```

---

## Capability Structure

```
capabilities/ralph/
├── capability.toml           # Capability metadata
├── package.json              # Dependencies
├── index.ts                  # Sandbox exports (for omni_execute)
├── types.d.ts                # Type definitions
├── definition.md             # Capability description for AI
├── skills/
│   ├── prd-creation/
│   │   └── SKILL.md          # PRD generation skill
│   └── ralph-orchestration/
│       └── SKILL.md          # Ralph workflow skill
├── rules/
│   ├── prd-structure.md      # Rules for PRD format
│   └── iteration-workflow.md # Rules for iteration behavior
└── docs/
    ├── agent-prompt.md       # Template for agent instructions
    └── spec-template.md      # Template for spec files
```

### `capability.toml`
```toml
[capability]
id = "ralph"
name = "Ralph Orchestrator"
version = "1.0.0"
description = "AI agent orchestrator for PRD-driven development"

[capability.requires]
env = []  # No required env vars

[capability.sync]
# Hook called on `omnidev agents sync`
on_sync = "sync"

[capability.cli]
# CLI subcommands provided by this capability
commands = ["ralph"]
```

### Sync Hook

When `omnidev agents sync` runs, Ralph's sync hook:

1. **Creates directory structure** if not exists:
   ```
   .omni/state/ralph/
   .omni/state/ralph/prds/
   .omni/state/ralph/completed-prds/
   ```

2. **Creates default config** if not exists:
   ```toml
   # .omni/state/ralph/config.toml
   [ralph]
   default_agent = "claude"
   default_iterations = 10
   ```

3. **Validates existing PRDs** - checks for orphaned stories, missing specs

4. **Updates .gitignore** - adds `.omni/state/ralph/` if not present

---

## Agent Prompt Template

The prompt sent to AI agents on each iteration:

```markdown
# Ralph Iteration Instructions

You are an autonomous coding agent working on the {project} project.

## Current PRD: {prd_name}
Branch: {branch_name}
Description: {description}

## Your Task

1. Read the progress log at `.omni/state/ralph/prds/{prd_name}/progress.txt`
2. Check you're on branch `{branch_name}`. If not, check it out or create from main.
3. Pick the **highest priority** user story where `passes: false`
4. **Read the spec file** for full context
5. Implement the story's `scope`
6. Run quality checks: `bun run check`
7. If checks pass, commit with message: `feat: [{story_id}] - {story_title}`
8. Update `.omni/state/ralph/prds/{prd_name}/prd.json` - set story's `passes: true`
9. Append progress to `.omni/state/ralph/prds/{prd_name}/progress.txt`

## Current Story

**{story_id}: {story_title}**
- Spec: {spec_file}
- Scope: {scope}
- Acceptance Criteria:
{acceptance_criteria}

## Progress So Far

{progress_summary}

## Codebase Patterns

{codebase_patterns}

## Quality Commands

```bash
bun run check         # typecheck + lint + format
bun test              # run tests
```

## Stop Condition

After completing the story, if ALL stories have `passes: true`, reply with:
<promise>COMPLETE</promise>

Otherwise, end your response normally.

## Important

- Work on ONE story per iteration
- Read the spec file first - it has the details
- Commit after each story
- Keep quality checks green
- Do NOT use type escape hatches
```

---

## Workflow

### 1. Initialize Ralph

```bash
omnidev ralph init
```

Creates:
- `.omni/state/ralph/config.toml` with defaults
- `.omni/state/ralph/prds/` directory
- `.omni/state/ralph/completed-prds/` directory

### 2. Create a PRD

Either interactively:
```bash
omnidev ralph prd create user-auth
# Prompts for description, branch name, etc.
```

Or from existing spec:
```bash
omnidev ralph prd create user-auth --from docs/user-auth-spec.md
# Parses spec and creates structured PRD
```

### 3. Add Specs

```bash
omnidev ralph spec create database-schema --prd user-auth
# Creates .omni/state/ralph/prds/user-auth/specs/001-database-schema.md
```

### 4. Add Stories

```bash
omnidev ralph story add "Database schema" --spec specs/001-database-schema.md --prd user-auth
# Adds story to prd.json linking to the spec
```

### 5. Run Orchestration

```bash
omnidev ralph start --prd user-auth --agent claude --iterations 20
```

Ralph:
1. Validates PRD exists and has incomplete stories
2. Spawns agent with iteration prompt
3. Monitors for completion or max iterations
4. Archives PRD if all stories pass and `auto_archive = true`

### 6. Monitor Progress

```bash
# Check status
omnidev ralph status

# View logs
omnidev ralph log --tail 50

# See patterns discovered
omnidev ralph patterns
```

### 7. Archive When Completed

```bash
omnidev ralph prd archive user-auth
# Moves to .omni/state/ralph/completed-prds/2026-01-09-user-auth/
```

---

## Sandbox API (for omni_execute)

The Ralph capability exports functions for use in the sandbox:

```typescript
// types.d.ts
declare module "ralph" {
  interface Story {
    id: string;
    title: string;
    specFile: string;
    scope: string;
    acceptanceCriteria: string[];
    priority: number;
    passes: boolean;
    notes: string;
  }

  interface PRD {
    name: string;
    branchName: string;
    description: string;
    createdAt: string;
    userStories: Story[];
  }

  // PRD operations
  function listPRDs(): Promise<string[]>;
  function getPRD(name: string): Promise<PRD>;
  function createPRD(name: string, options: Partial<PRD>): Promise<PRD>;
  function updatePRD(name: string, updates: Partial<PRD>): Promise<PRD>;
  function archivePRD(name: string): Promise<void>;

  // Story operations
  function getNextStory(prdName: string): Promise<Story | null>;
  function markStoryPassed(prdName: string, storyId: string): Promise<void>;
  function markStoryFailed(prdName: string, storyId: string): Promise<void>;

  // Progress operations
  function appendProgress(prdName: string, content: string): Promise<void>;
  function getProgress(prdName: string): Promise<string>;
  function getPatterns(prdName: string): Promise<string[]>;

  // Active PRD
  function getActivePRD(): Promise<string | null>;
  function setActivePRD(name: string): Promise<void>;
}
```

---

## Integration with Existing OmniDev

### CLI Integration

The Ralph capability registers CLI commands through `capability.toml`:

```toml
[capability.cli]
commands = ["ralph"]
```

The CLI package discovers capabilities with CLI commands and mounts them:

```typescript
// packages/cli/src/commands/ralph.ts
import { buildCommand } from "@stricli/core";
import { loadRalphCapability } from "@omnidev/core";

export const ralphCommand = buildCommand({
  name: "ralph",
  description: "AI agent orchestrator for PRD-driven development",
  subcommands: {
    init: initCommand,
    start: startCommand,
    stop: stopCommand,
    status: statusCommand,
    prd: prdCommand,      // has subcommands: list, create, select, view, archive, delete
    story: storyCommand,  // has subcommands: list, pass, reset, add
    spec: specCommand,    // has subcommands: list, create, view
    log: logCommand,
    patterns: patternsCommand,
    cleanup: cleanupCommand,
  },
});
```

### Sync Hook Integration

Capabilities can define sync hooks in `capability.toml`:

```toml
[capability.sync]
on_sync = "sync"
```

The core package calls these hooks during `omnidev agents sync`:

```typescript
// packages/core/src/capability/sync.ts
export async function syncCapability(capability: LoadedCapability): Promise<void> {
  if (capability.config.sync?.on_sync) {
    const syncFn = await import(capability.path + "/index.ts");
    await syncFn[capability.config.sync.on_sync]();
  }
}
```

### MCP Tool Integration

Ralph state can be queried via `omni_query`:

```typescript
// When query includes "ralph" or "prd" or "stories"
const ralphState = await getRalphState();
return {
  activePRD: ralphState.activePRD,
  stories: ralphState.currentStories,
  progress: ralphState.recentProgress,
};
```

---

## Updated User Stories for PRD

Replace US-038 through US-043 with Ralph capability stories:

```json
{
  "id": "US-038",
  "title": "Create Ralph capability structure",
  "taskFile": "scripts/ralph/tasks/prd-009-ralph-capability.md",
  "scope": "Capability structure only (capability.toml, package.json, index.ts, types)",
  "acceptanceCriteria": [
    "capabilities/ralph/capability.toml exists with metadata",
    "capabilities/ralph/package.json exists",
    "capabilities/ralph/index.ts exists with placeholder exports",
    "capabilities/ralph/types.d.ts exists with interfaces",
    "Capability discovered by loader",
    "Typecheck passes"
  ],
  "priority": 38,
  "passes": false
},
{
  "id": "US-039",
  "title": "Implement Ralph state management",
  "taskFile": "scripts/ralph/tasks/prd-009-ralph-capability.md",
  "scope": "State management only (PRD, story, progress operations)",
  "acceptanceCriteria": [
    "listPRDs, getPRD, createPRD, updatePRD functions work",
    "markStoryPassed, markStoryFailed functions work",
    "appendProgress, getProgress, getPatterns functions work",
    "State persisted to .omni/state/ralph/",
    "Tests cover state operations",
    "Typecheck passes"
  ],
  "priority": 39,
  "passes": false
},
{
  "id": "US-040",
  "title": "Implement Ralph sync hook",
  "taskFile": "scripts/ralph/tasks/prd-009-ralph-capability.md",
  "scope": "Sync hook only",
  "acceptanceCriteria": [
    "Sync creates .omni/state/ralph/ directory structure",
    "Sync creates default config.toml if not exists",
    "Sync validates existing PRDs",
    "Sync updates .gitignore",
    "omnidev agents sync triggers Ralph sync",
    "Typecheck passes"
  ],
  "priority": 40,
  "passes": false
},
{
  "id": "US-041",
  "title": "Implement Ralph CLI commands (core)",
  "taskFile": "scripts/ralph/tasks/prd-009-ralph-capability.md",
  "scope": "Core CLI commands only (init, start, stop, status)",
  "acceptanceCriteria": [
    "omnidev ralph init creates structure",
    "omnidev ralph start spawns agent",
    "omnidev ralph stop gracefully stops",
    "omnidev ralph status shows current state",
    "Typecheck passes"
  ],
  "priority": 41,
  "passes": false
},
{
  "id": "US-042",
  "title": "Implement Ralph CLI commands (management)",
  "taskFile": "scripts/ralph/tasks/prd-009-ralph-capability.md",
  "scope": "Management CLI commands (prd, story, spec subcommands)",
  "acceptanceCriteria": [
    "omnidev ralph prd list/create/select/view/archive work",
    "omnidev ralph story list/pass/reset/add work",
    "omnidev ralph spec list/create/view work",
    "Typecheck passes"
  ],
  "priority": 42,
  "passes": false
},
{
  "id": "US-043",
  "title": "Create Ralph skills and rules",
  "taskFile": "scripts/ralph/tasks/prd-009-ralph-capability.md",
  "scope": "Skills and rules files only",
  "acceptanceCriteria": [
    "skills/prd-creation/SKILL.md exists",
    "skills/ralph-orchestration/SKILL.md exists",
    "rules/prd-structure.md exists",
    "rules/iteration-workflow.md exists",
    "Skills and rules discovered by loader",
    "Typecheck passes"
  ],
  "priority": 43,
  "passes": false
}
```

---

## Open Questions

1. **Agent stdin vs file** - Should we pipe the prompt to stdin or write to a temp file?
   - Current: stdin works for most agents
   - Consider: File might be more reliable for large prompts

2. **Iteration timeout** - Should there be a per-iteration timeout?
   - Consider: 30 minute default, configurable

3. **Parallel stories** - Should we support running multiple stories in parallel?
   - Current: One story at a time (simpler, safer)
   - Future: Could add `--parallel <n>` flag

4. **Spec templates** - Should we ship default spec templates?
   - Yes: database, api, ui, refactor templates

5. **Progress format** - Should progress be structured (JSON) or freeform (Markdown)?
   - Current: Markdown is more readable
   - Consider: Structured metadata header + markdown body

---

## Implementation Order

1. **Phase 1: Foundation**
   - Capability structure (US-038)
   - State management (US-039)
   
2. **Phase 2: Integration**
   - Sync hook (US-040)
   - Update core to support sync hooks
   
3. **Phase 3: CLI**
   - Core commands (US-041)
   - Management commands (US-042)
   
4. **Phase 4: AI Integration**
   - Skills and rules (US-043)
   - Agent prompt template
   - Integration with omni_query

---

## Success Criteria

- [ ] `omnidev ralph init` creates proper structure
- [ ] `omnidev ralph prd create` makes new PRD interactively
- [ ] `omnidev ralph start` spawns agent and runs iterations
- [ ] Agent can complete stories and update PRD
- [ ] Progress log captures learnings
- [ ] Completed PRDs archive automatically
- [ ] Skills guide AI in creating PRDs
- [ ] Works with claude, codex, and amp agents

