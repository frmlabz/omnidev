# Example Capability: `tasks` (complete)

This is a complete example of a built-in **Tasks & Plan Management** capability that demonstrates all extension points:

- **Sandbox Tools**: Functions the LLM can call via `omni_execute`
- **CLI Commands**: Commands added to the `omnidev` CLI
- **TUI Views**: OpenTUI React components for rich terminal UIs
- **Skills & Rules**: Agent instructions and guidelines
- **Type Definitions**: `.d.ts` files for LLM type safety
- **Environment Variables**: `[env]` declarations in capability.toml

> **Note**: The MCP only has two tools: `omni_query` and `omni_execute`. Capabilities extend the **sandbox**, not the MCP. LLMs use sandbox functions by writing code that gets executed via `omni_execute`.

---

## On-disk layout

OmniDev uses a **split directory structure**: `omni/` (visible, committed) for capabilities, provider directories (gitignored) for skills, `.omni/` (hidden, gitignored) for state and secrets.

**Key insight**: Skills go directly to provider locations (`.claude/skills/`, `.cursor/rules/`). These are gitignored, so profile switching keeps git clean.

```
project-root/
├── package.json                # Bun workspace: ["omni/capabilities/*"]
├── node_modules/               # Shared dependencies (hoisted)
├── agents.md                   # COMMITTED (static reference)
├── .claude/
│   ├── claude.md               # COMMITTED (static reference)
│   └── skills/                 # GITIGNORED (skills generated directly here)
│       └── task-management/
│           └── SKILL.md
├── .cursor/
│   └── rules/
│       └── omnidev-tasks.mdc   # GITIGNORED (generated directly here)
│
├── omni/                       # VISIBLE, COMMITTED
│   ├── config.toml             # Team config + profile definitions
│   └── capabilities/
│       └── tasks/
│           ├── package.json        # npm package (dependencies)
│           ├── capability.toml     # OmniDev config (CLI, env, metadata)
│           ├── definition.md       # Documentation
│           ├── index.ts            # Main exports (tools, CLI, views)
│           ├── types.d.ts          # Type definitions for LLM
│           ├── tools/
│           │   └── taskManager.ts  # Core task logic (sandbox API)
│           ├── cli/
│           │   ├── commands.ts     # Stricli command definitions
│           │   └── views/
│           │       ├── TaskList.tsx
│           │       ├── TaskBoard.tsx
│           │       └── TaskDetail.tsx
│           ├── docs/
│           │   └── usage.md
│           ├── rules/
│           │   └── task-workflow.md
│           └── skills/
│               └── task-management/
│                   └── SKILL.md    # SOURCE skill (copied to providers)
│
└── .omni/                      # HIDDEN, GITIGNORED
    ├── config.local.toml       # Personal overrides
    ├── .env                    # Secrets
    ├── active-profile          # Current profile (e.g., "frontend")
    ├── generated/              # Other generated content
    │   ├── rules.md            # Compiled rules (for agents.md reference)
    │   └── types.d.ts          # Combined type definitions
    ├── sandbox/                # Execution environment
    │   └── node_modules/       # Symlinks to capabilities
    │       └── tasks → ../../../omni/capabilities/tasks
    ├── state/
    │   ├── tasks.json          # Task database (runtime state)
    │   └── plan.json           # Plan data (runtime state)
    └── server.pid              # For hot reload signals
```

**Gitignore entries** (added by `omnidev init`):
```gitignore
.omni/
.claude/skills/
.cursor/rules/omnidev-*.mdc
```

---

## `capability.toml`

This is the config OmniDev loads to register the capability. Everything else is discovered from the filesystem.

```toml
[capability]
id = "tasks"
name = "Tasks"
version = "0.1.0"
description = "Basic task + plan management for OmniDev agents."

[exports]
# Namespace to inject into the sandbox (`import * as tasks from 'tasks'`).
# Optional; defaults to a sanitized capability id.
module = "tasks"

# Environment variables are not needed for the tasks capability,
# but here's what it would look like if they were:
# [env]
# TASKS_API_KEY = { required = true, secret = true }
# TASKS_TIMEOUT = { default = "30000" }
```

---

## `package.json`

Each capability is a standard npm/Bun package. This enables Bun Workspaces to manage dependencies.

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

**Why both `capability.toml` and `package.json`?**

| File | Purpose |
|------|---------|
| `capability.toml` | OmniDev-specific: `[cli]`, `[env]`, `[mcp]`, metadata |
| `package.json` | Standard npm: dependencies, entry point |

When you run `bun install` at the project root, all capability dependencies are installed to the shared `node_modules/`.

---

**What OmniDev discovers automatically:**
- `index.ts` → Main entry point (loaded via `import()`)
- `package.json` → Dependencies (installed via Bun workspace)
- `types.d.ts` → Type definitions for LLM (included in `omni_query`)
- `definition.md` + `docs/**` → Searchable docs for `omni_query`
- `rules/*.md` → Guidelines included in agent sync
- `skills/*/SKILL.md` → Agent Skills

**Example: MCP-based capability with environment variables:**
```toml
[capability]
id = "github"
name = "GitHub"
version = "0.1.0"
description = "GitHub operations via MCP."

[exports]
module = "github"

[env]
# Required secret - fails fast if missing
GITHUB_TOKEN = { required = true, secret = true }
# Optional with default
GITHUB_API_URL = { default = "https://api.github.com" }

[mcp]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
transport = "stdio"
```

**Where secrets are stored:**
- `.omni/.env` (gitignored) - project secrets
- `~/.omni/.env` - user-global secrets

```bash
# .omni/.env (NEVER committed!)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## `definition.md`

This is what a human reads. Keep it clean Markdown. Treat it as the "landing page" for the capability.

```md
# Tasks capability

Provides task and plan management primitives for OmniDev agents.

## What it's for

- Track work items during a session
- Maintain an explicit execution plan
- Reduce agent thrash by making progress visible

## Sandbox API (TypeScript)

Use these functions when writing code via `omni_execute`:

```typescript
import * as tasks from 'tasks';

// Create a task
const id = await tasks.create("Title", "Description", ["tag1", "tag2"]);

// List tasks (optionally filter by status)
const all = await tasks.list();
const todo = await tasks.list('todo');

// Get, update, complete
const task = await tasks.get(id);
await tasks.update(id, { status: 'in_progress' });
await tasks.complete(id);

// Plan management
const plan = await tasks.planGet();
await tasks.planSet([{ id: "1", title: "Step 1", status: "todo" }]);
```

## CLI Commands (for humans)

| Command | Description |
|---------|-------------|
| `omnidev tasks list` | List all tasks (TUI) |
| `omnidev tasks add <title>` | Create a new task |
| `omnidev tasks show <id>` | Show task details (TUI) |
| `omnidev tasks start <id>` | Start working on task |
| `omnidev tasks complete <id>` | Mark task as done |
| `omnidev tasks block <id>` | Mark task as blocked |
| `omnidev tasks board` | Interactive Kanban board (TUI) |
```

---

## `types.d.ts` (Type Definitions for LLMs)

This file provides type definitions that `omni_query` returns when `include_types: true`. It helps LLMs write correct TypeScript without guessing function signatures.

```typescript
// tasks/types.d.ts
// Type definitions for the tasks capability
// These are included in omni_query response for LLM type safety

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

export interface PlanItem {
  id: string;
  title: string;
  status: Status;
}

/**
 * Create a new task
 * @param title - Task title
 * @param description - Optional description
 * @param tags - Optional tags for categorization
 * @returns The new task ID
 */
export function create(
  title: string,
  description?: string | null,
  tags?: string[]
): Promise<string>;

/**
 * List tasks, optionally filtered by status
 * @param status - Filter by status (optional)
 * @returns Array of tasks
 */
export function list(status?: Status): Promise<Task[]>;

/**
 * Get a task by ID
 * @param taskId - The task ID
 * @returns The task
 * @throws Error if task not found
 */
export function get(taskId: string): Promise<Task>;

/**
 * Update a task
 * @param taskId - The task ID
 * @param fields - Fields to update
 * @returns The updated task
 */
export function update(
  taskId: string,
  fields: Partial<Omit<Task, 'id' | 'createdAt'>>
): Promise<Task>;

/**
 * Mark a task as complete
 * @param taskId - The task ID
 * @returns The completed task
 */
export function complete(taskId: string): Promise<Task>;

/**
 * Get the current plan
 * @returns Array of plan items
 */
export function planGet(): Promise<PlanItem[]>;

/**
 * Set the plan
 * @param items - The plan items
 * @returns The saved plan
 */
export function planSet(items: PlanItem[]): Promise<PlanItem[]>;
```

When the LLM asks "What tools do I have?" via `omni_query`, OmniDev returns this type definition so the LLM knows exactly what functions are available and their signatures.

---

## `index.ts` (main exports)

This is the entry point OmniDev imports. Since capabilities are Bun packages, **everything can be programmatic**. Export what you want directly, or let OmniDev discover it from the filesystem.

```typescript
import type { Skill, Rule, Doc } from '@omnidev/core';

// ============================================
// 1. SANDBOX TOOLS
// ============================================
// Functions available in the sandbox via `import * as tasks from 'tasks'`
export * from './tools/taskManager';

// ============================================
// 2. CLI COMMANDS
// ============================================
export { cliCommands } from './cli/commands';

// ============================================
// 3. TUI VIEWS
// ============================================
export { TaskListView } from './cli/views/TaskList';
export { TaskBoardView } from './cli/views/TaskBoard';
export { TaskDetailView } from './cli/views/TaskDetail';

export const cliViews: Record<string, string> = {
  'tasks.list': 'TaskListView',
  'tasks.board': 'TaskBoardView',
  'tasks.show': 'TaskDetailView',
};

// ============================================
// 4. SKILLS (programmatic OR filesystem)
// ============================================
// Option A: Export directly (takes precedence)
export const skills: Skill[] = [
  {
    name: 'task-management',
    description: 'Maintain an explicit plan and update tasks as work progresses.',
    instructions: `
## When to use this skill
- Working on multi-step tasks
- Progress needs to be visible

## Key rules
- Keep exactly one task in_progress at a time
- Update status as you work
    `,
  },
];

// Option B: Let OmniDev discover from skills/*/SKILL.md (if skills not exported)

// ============================================
// 5. RULES (programmatic OR filesystem)
// ============================================
// Option A: Export directly
export const rules: Rule[] = [
  {
    name: 'task-workflow',
    content: `
# Task Workflow Rules
- Always check current tasks before creating new ones
- Use clear, actionable titles
- Complete tasks before starting new ones
    `,
  },
];

// Option B: Let OmniDev discover from rules/*.md (if rules not exported)

// ============================================
// 6. DOCS (programmatic OR filesystem)
// ============================================
// Option A: Export directly (can be dynamic!)
export const docs: Doc[] = [
  {
    name: 'usage',
    content: `# Tasks Usage\n\nUse \`tasks.create()\` to create a task...`,
  },
];

// Option B: Async function for dynamic docs (fetch from API, generate, etc.)
export async function getDocs(): Promise<Doc[]> {
  // Could fetch from Notion, Confluence, or generate from code
  return [
    { name: 'api', content: generateApiReference() },
  ];
}

// Option C: Let OmniDev discover from docs/*.md (if neither exported)

// ============================================
// 7. TYPE DEFINITIONS (programmatic OR filesystem)
// ============================================
// Option A: Export directly
export const typeDefinitions = `
export type Status = 'todo' | 'in_progress' | 'blocked' | 'done';
export interface Task { id: string; title: string; status: Status; }
export function create(title: string): Promise<string>;
`;

// Option B: Let OmniDev read from types.d.ts (if not exported)
```

### Resolution Order

OmniDev checks exports first, then falls back to filesystem:

| Component | Check Export | Fallback to Filesystem |
|-----------|--------------|------------------------|
| Skills | `skills` array | `skills/*/SKILL.md` |
| Rules | `rules` array | `rules/*.md` |
| Docs | `docs` array or `getDocs()` | `docs/*.md` |
| Types | `typeDefinitions` string | `types.d.ts` |

**This means you can:**
- Use markdown files (simple, static)
- Export objects (programmatic, versioned with code)
- Fetch from APIs (dynamic, external sources)
- Generate at runtime (computed from code/state)
- Mix and match (some from files, some programmatic)

---

## `tools/taskManager.ts` (skeleton)

This is the core task logic, exposed to the sandbox. The persistence mechanism is intentionally simple for MVP.

```typescript
import { join } from 'path';

const OMNI_DIR = process.env.OMNI_DIR || '.omni';
const STATE_DIR = join(OMNI_DIR, 'state');
const TASKS_FILE = join(STATE_DIR, 'tasks.json');
const PLAN_FILE = join(STATE_DIR, 'plan.json');

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

export interface PlanItem {
  id: string;
  title: string;
  status: Status;
}

async function loadJson<T>(path: string, defaultValue: T): Promise<T> {
  try {
    const file = Bun.file(path);
    if (await file.exists()) {
      return await file.json();
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return defaultValue;
}

async function saveJson(path: string, data: unknown): Promise<void> {
  await Bun.write(path, JSON.stringify(data, null, 2));
}

export async function create(
  title: string,
  description: string | null = null,
  tags: string[] = []
): Promise<string> {
  const now = Date.now();
  const tasks = await loadJson<Record<string, Task>>(TASKS_FILE, {});
  
  const taskId = `task_${now}`;
  const task: Task = {
    id: taskId,
    title,
    description,
    status: 'todo',
    tags,
    createdAt: now,
    updatedAt: now,
  };
  
  tasks[taskId] = task;
  await saveJson(TASKS_FILE, tasks);
  return taskId;
}

export async function list(status?: Status): Promise<Task[]> {
  const tasks = await loadJson<Record<string, Task>>(TASKS_FILE, {});
  const values = Object.values(tasks);
  
  if (status === undefined) {
    return values;
  }
  return values.filter(t => t.status === status);
}

export async function get(taskId: string): Promise<Task> {
  const tasks = await loadJson<Record<string, Task>>(TASKS_FILE, {});
  
  if (!(taskId in tasks)) {
    throw new Error(`Unknown task: ${taskId}`);
  }
  return tasks[taskId];
}

export async function update(
  taskId: string,
  fields: Partial<Omit<Task, 'id' | 'createdAt'>>
): Promise<Task> {
  const tasks = await loadJson<Record<string, Task>>(TASKS_FILE, {});
  
  if (!(taskId in tasks)) {
    throw new Error(`Unknown task: ${taskId}`);
  }
  
  const task = tasks[taskId];
  Object.assign(task, fields, { updatedAt: Date.now() });
  tasks[taskId] = task;
  
  await saveJson(TASKS_FILE, tasks);
  return task;
}

export async function complete(taskId: string): Promise<Task> {
  return update(taskId, { status: 'done' });
}

export async function planGet(): Promise<PlanItem[]> {
  return loadJson<PlanItem[]>(PLAN_FILE, []);
}

export async function planSet(items: PlanItem[]): Promise<PlanItem[]> {
  await saveJson(PLAN_FILE, items);
  return items;
}
```

---

## `cli/commands.ts` (Stricli commands)

CLI commands that extend `omnidev` with task management.

```typescript
import type { CommandDefinition } from '@omnidev/core';
import * as tasks from '../tools/taskManager';

export const cliCommands: Record<string, CommandDefinition> = {
  tasks: {
    description: 'Manage tasks and plans',
    subcommands: {
      list: {
        description: 'List all tasks',
        flags: {
          status: {
            type: 'string',
            description: 'Filter by status (todo, in_progress, blocked, done)',
            short: 's',
          },
        },
        // Returns data for the TUI view
        run: async ({ flags }) => {
          const status = flags.status as tasks.Status | undefined;
          const taskList = await tasks.list(status);
          return { tasks: taskList };
        },
      },
      
      add: {
        description: 'Create a new task',
        positional: {
          title: {
            type: 'string',
            description: 'Task title',
            required: true,
          },
        },
        flags: {
          description: {
            type: 'string',
            description: 'Task description',
            short: 'd',
          },
        },
        run: async ({ positional, flags }) => {
          const taskId = await tasks.create(
            positional.title,
            flags.description ?? null
          );
          console.log(`Created task: ${taskId}`);
          return { taskId };
        },
      },
      
      complete: {
        description: 'Mark a task as done',
        positional: {
          id: {
            type: 'string',
            description: 'Task ID',
            required: true,
          },
        },
        run: async ({ positional }) => {
          const task = await tasks.complete(positional.id);
          console.log(`Completed: ${task.title}`);
          return { task };
        },
      },
      
      board: {
        description: 'Open interactive task board',
        // This command uses TUI, so it just returns data
        run: async () => {
          const taskList = await tasks.list();
          return { tasks: taskList };
        },
      },

      show: {
        description: 'Show task details',
        positional: {
          id: {
            type: 'string',
            description: 'Task ID',
            required: true,
          },
        },
        run: async ({ positional }) => {
          const task = await tasks.get(positional.id);
          return { task };
        },
      },

      start: {
        description: 'Start working on a task (set status to in_progress)',
        positional: {
          id: {
            type: 'string',
            description: 'Task ID',
            required: true,
          },
        },
        run: async ({ positional }) => {
          const task = await tasks.update(positional.id, { status: 'in_progress' });
          console.log(`Started: ${task.title}`);
          return { task };
        },
      },

      block: {
        description: 'Mark a task as blocked',
        positional: {
          id: {
            type: 'string',
            description: 'Task ID',
            required: true,
          },
        },
        flags: {
          reason: {
            type: 'string',
            description: 'Reason for blocking',
            short: 'r',
          },
        },
        run: async ({ positional, flags }) => {
          const task = await tasks.update(positional.id, { 
            status: 'blocked',
            description: flags.reason ? `Blocked: ${flags.reason}` : undefined,
          });
          console.log(`Blocked: ${task.title}`);
          return { task };
        },
      },
    },
  },
};
```

---

## `cli/views/TaskList.tsx` (OpenTUI component)

A React component for rendering the task list in the terminal.

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from '@opentui/react';
import type { Task, Status } from '../../tools/taskManager';

interface Props {
  tasks: Task[];
  onSelect?: (task: Task) => void;
}

const STATUS_ICONS: Record<Status, string> = {
  todo: '○',
  in_progress: '◐',
  blocked: '✕',
  done: '●',
};

const STATUS_COLORS: Record<Status, string> = {
  todo: 'gray',
  in_progress: 'yellow',
  blocked: 'red',
  done: 'green',
};

export const TaskListView: React.FC<Props> = ({ tasks, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(tasks.length - 1, i + 1));
    }
    if (key.return && onSelect && tasks[selectedIndex]) {
      onSelect(tasks[selectedIndex]);
    }
    if (input === 'q') {
      process.exit(0);
    }
  });

  if (tasks.length === 0) {
    return (
      <Box padding={1}>
        <Text color="gray">No tasks found. Create one with: omnidev tasks add "title"</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>📋 Tasks</Text>
        <Text color="gray"> ({tasks.length})</Text>
      </Box>
      
      {tasks.map((task, index) => {
        const isSelected = index === selectedIndex;
        const icon = STATUS_ICONS[task.status];
        const color = STATUS_COLORS[task.status];
        
        return (
          <Box key={task.id}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '▸ ' : '  '}
            </Text>
            <Text color={color}>{icon} </Text>
            <Text color={isSelected ? 'cyan' : undefined}>
              {task.title}
            </Text>
            {task.tags.length > 0 && (
              <Text color="gray"> [{task.tags.join(', ')}]</Text>
            )}
          </Box>
        );
      })}
      
      <Box marginTop={1}>
        <Text color="gray">↑/↓ navigate • Enter select • q quit</Text>
      </Box>
    </Box>
  );
};
```

---

## `cli/views/TaskBoard.tsx` (OpenTUI component)

A more advanced Kanban-style board view.

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from '@opentui/react';
import type { Task, Status } from '../../tools/taskManager';

interface Props {
  tasks: Task[];
}

const COLUMNS: Status[] = ['todo', 'in_progress', 'blocked', 'done'];
const COLUMN_TITLES: Record<Status, string> = {
  todo: '📥 To Do',
  in_progress: '🔄 In Progress',
  blocked: '🚫 Blocked',
  done: '✅ Done',
};

export const TaskBoardView: React.FC<Props> = ({ tasks }) => {
  const [selectedColumn, setSelectedColumn] = useState(0);
  const [selectedRow, setSelectedRow] = useState(0);

  const tasksByStatus = COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<Status, Task[]>);

  useInput((input, key) => {
    if (key.leftArrow) {
      setSelectedColumn(c => Math.max(0, c - 1));
      setSelectedRow(0);
    }
    if (key.rightArrow) {
      setSelectedColumn(c => Math.min(COLUMNS.length - 1, c + 1));
      setSelectedRow(0);
    }
    if (key.upArrow) {
      setSelectedRow(r => Math.max(0, r - 1));
    }
    if (key.downArrow) {
      const currentColumn = COLUMNS[selectedColumn];
      const maxRow = tasksByStatus[currentColumn].length - 1;
      setSelectedRow(r => Math.min(maxRow, r + 1));
    }
    if (input === 'q') {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>📋 Task Board</Text>
      </Box>
      
      <Box>
        {COLUMNS.map((status, colIndex) => {
          const columnTasks = tasksByStatus[status];
          const isSelectedColumn = colIndex === selectedColumn;
          
          return (
            <Box
              key={status}
              flexDirection="column"
              width={25}
              marginRight={1}
              borderStyle={isSelectedColumn ? 'bold' : 'single'}
              borderColor={isSelectedColumn ? 'cyan' : 'gray'}
              padding={1}
            >
              <Text bold color={isSelectedColumn ? 'cyan' : undefined}>
                {COLUMN_TITLES[status]}
              </Text>
              <Text color="gray">({columnTasks.length})</Text>
              
              <Box flexDirection="column" marginTop={1}>
                {columnTasks.length === 0 ? (
                  <Text color="gray">—</Text>
                ) : (
                  columnTasks.map((task, rowIndex) => {
                    const isSelected = isSelectedColumn && rowIndex === selectedRow;
                    return (
                      <Box key={task.id} marginBottom={1}>
                        <Text
                          color={isSelected ? 'cyan' : undefined}
                          inverse={isSelected}
                        >
                          {task.title.slice(0, 20)}
                          {task.title.length > 20 ? '…' : ''}
                        </Text>
                      </Box>
                    );
                  })
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray">←/→ columns • ↑/↓ tasks • q quit</Text>
      </Box>
    </Box>
  );
};
```

---

## `cli/views/TaskDetail.tsx` (OpenTUI component)

A detailed view of a single task.

```tsx
import React from 'react';
import { Box, Text } from '@opentui/react';
import type { Task, Status } from '../../tools/taskManager';

interface Props {
  task: Task;
}

const STATUS_BADGES: Record<Status, { icon: string; color: string; label: string }> = {
  todo: { icon: '○', color: 'gray', label: 'To Do' },
  in_progress: { icon: '◐', color: 'yellow', label: 'In Progress' },
  blocked: { icon: '✕', color: 'red', label: 'Blocked' },
  done: { icon: '●', color: 'green', label: 'Done' },
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export const TaskDetailView: React.FC<Props> = ({ task }) => {
  const badge = STATUS_BADGES[task.status];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">📋 Task Details</Text>
      </Box>

      {/* Title */}
      <Box marginBottom={1}>
        <Text bold>{task.title}</Text>
      </Box>

      {/* Status */}
      <Box marginBottom={1}>
        <Text color="gray">Status: </Text>
        <Text color={badge.color}>{badge.icon} {badge.label}</Text>
      </Box>

      {/* ID */}
      <Box marginBottom={1}>
        <Text color="gray">ID: </Text>
        <Text>{task.id}</Text>
      </Box>

      {/* Description */}
      {task.description && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray">Description:</Text>
          <Box marginLeft={2}>
            <Text>{task.description}</Text>
          </Box>
        </Box>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <Box marginBottom={1}>
          <Text color="gray">Tags: </Text>
          {task.tags.map((tag, i) => (
            <React.Fragment key={tag}>
              <Text color="blue">{tag}</Text>
              {i < task.tags.length - 1 && <Text>, </Text>}
            </React.Fragment>
          ))}
        </Box>
      )}

      {/* Timestamps */}
      <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Box>
          <Text color="gray">Created: </Text>
          <Text>{formatDate(task.createdAt)}</Text>
        </Box>
        <Box>
          <Text color="gray">Updated: </Text>
          <Text>{formatDate(task.updatedAt)}</Text>
        </Box>
      </Box>

      {/* Actions hint */}
      <Box marginTop={1}>
        <Text color="gray">
          Actions: omnidev tasks start {task.id} | complete {task.id} | block {task.id}
        </Text>
      </Box>
    </Box>
  );
};
```

---

## `skills/task-management/SKILL.md` (example)

Skills follow the Agent Skills spec: a directory with a `SKILL.md` containing YAML frontmatter + Markdown body.

```md
---
name: task-management
description: Maintain an explicit plan and update tasks as work progresses. Use for multi-step work and when tracking progress matters.
---

## When to use this skill

Use task management when:
- Working on multi-step tasks
- Progress needs to be visible and trackable
- You need to maintain context across multiple operations

## Task workflow

1. **Before starting work**: Check existing tasks with `tasks_list`
2. **Create tasks**: Break work into actionable items with `tasks_create`
3. **Start work**: Mark one task `in_progress` with `tasks_update`
4. **Track progress**: Update status as you work
5. **Complete**: Mark done with `tasks_complete`

## Key rules

- Keep exactly **one task** `in_progress` at a time
- Always check the task list before creating duplicates
- Update task status when state changes
- If blocked, mark as `blocked` and explain why

## Using the tasks API

Write code via `omni_execute` to manage tasks:

```typescript
import * as tasks from 'tasks';

// Create a task
const id = await tasks.create("Implement feature X", "Description here");

// Start working
await tasks.update(id, { status: 'in_progress' });

// Check progress
const inProgress = await tasks.list('in_progress');
console.log(`Currently working on: ${inProgress.length} tasks`);

// Complete when done
await tasks.complete(id);
```

## Plan management

For complex work, maintain an explicit plan:

```typescript
import * as tasks from 'tasks';

// Set a plan
await tasks.planSet([
  { id: "1", title: "Research requirements", status: "done" },
  { id: "2", title: "Design solution", status: "in_progress" },
  { id: "3", title: "Implement", status: "todo" },
  { id: "4", title: "Test", status: "todo" },
]);

// Check plan progress
const plan = await tasks.planGet();
```
```

---

## `rules/task-workflow.md` (example)

Rules are simple markdown files with guidelines or constraints. They're included in agent sync output when the capability is enabled.

```markdown
# Task Workflow Rules

These rules ensure consistent task management during development.

## Creating Tasks

- Always check the current task list before creating new tasks
- Use clear, actionable titles (start with a verb)
- Add descriptions for complex tasks

## Working on Tasks

- Keep exactly one task `in_progress` at a time
- Update task status as you work
- When blocked, mark the task as `blocked` and explain why

## Completing Tasks

- Verify the work is done before marking complete
- Complete tasks before starting new ones
- Review the plan after completing a task
```

When you run `omnidev agents sync`, this rule file is included in the generated agent configuration (agents.md, .claude/claude.md, etc.) if the `tasks` capability is enabled.

---

## Summary: Extension Points

This capability demonstrates all the ways a capability can extend OmniDev:

| Extension Point | What it does | Files |
|-----------------|--------------|-------|
| **Sandbox Tools** | Functions LLMs can call via `omni_execute` | `tools/taskManager.ts` |
| **Type Definitions** | Signatures for LLM type safety | `types.d.ts` |
| **CLI Commands** | Commands added to `omnidev` CLI | `cli/commands.ts` |
| **TUI Views** | Rich terminal UIs for CLI commands | `cli/views/*.tsx` |
| **Skills** | Agent behavior instructions | `skills/*/SKILL.md` |
| **Rules** | Guidelines and constraints | `rules/*.md` |
| **Docs** | Searchable documentation | `docs/*.md` |
| **Env Vars** | Secrets and configuration | `[env]` in `capability.toml` |
| **Dependencies** | npm packages for capability | `package.json` |

### How it works

**The MCP has only 2 tools:**
1. `omni_query` - Search capabilities, docs, skills, **return type definitions**
2. `omni_execute` - Run code in the sandbox

**Capabilities extend the sandbox**, not the MCP. When the LLM needs to use tasks:

```
1. LLM calls omni_query with { include_types: true }
   → Gets type definitions for 'tasks' module

2. LLM calls omni_execute with code:
   
   import * as tasks from 'tasks';
   const id = await tasks.create("My task");
   console.log(`Created: ${id}`);

3. OmniDev prepares the sandbox:
   - Ensures symlink: .omni/sandbox/node_modules/tasks → omni/capabilities/tasks
   - Writes code to .omni/sandbox/main.ts

4. OmniDev runs: bun run .omni/sandbox/main.ts
   - import 'tasks' resolves via symlink
   - Dependencies resolve via Bun workspace (root node_modules/)
   - Environment variables from .omni/.env are injected
   - Code executes, task is created

5. OmniDev returns:
   {
     "exit_code": 0,
     "stdout": "Created: task_1234567890",
     "stderr": "",
     "changed_files": [".omni/state/tasks.json"]
   }
```

**CLI is for humans:**
```
User runs: omnidev tasks add "My task"
→ Stricli routes to tasks.add command
→ Handler calls tasks.create()
→ Prints result (or renders TUI view)
```

Both LLM (via sandbox) and humans (via CLI) use the same underlying `taskManager.ts` logic.

### Profile Switching

```bash
# Switch to frontend profile
omnidev profile set frontend

# This:
# 1. Writes "frontend" to .omni/active-profile
# 2. Regenerates .omni/generated/rules.md (with frontend caps' rules)
# 3. Regenerates .omni/generated/skills.md (with frontend caps' skills)
# 4. Notifies running MCP server to reload
#
# Git stays clean! Only .omni/ (gitignored) changes.
```

### Reference Pattern & Skills Flow

**Skills** are copied directly to provider locations (where they're discovered):

```
omni/capabilities/tasks/skills/task-management/SKILL.md
                    ↓ (omnidev agents sync)
.claude/skills/task-management/SKILL.md      ← Claude discovers here
.cursor/rules/omnidev-task-management.mdc    ← Cursor discovers here
```

**Rules** use the reference pattern:

**`agents.md`** (committed once):
```markdown
# Agent Configuration
> Managed by OmniDev. Run `omnidev agents sync` to update.

@import .omni/generated/rules.md
```

This way:
- Profile switching doesn't create git diffs
- Each developer can have their own active profile
- CI/CD can set profile per environment
- Providers discover skills in their expected locations

### Directory Split Recap

| Directory | Git Status | Contents |
|-----------|------------|----------|
| `agents.md`, `.claude/claude.md` | **Committed** | Static reference files (rarely change) |
| `omni/` | **Committed** | Capabilities, shared config, profile definitions |
| `.claude/skills/` | **Gitignored** | Skills for Claude (generated directly) |
| `.cursor/rules/omnidev-*` | **Gitignored** | Rules for Cursor (generated directly) |
| `.omni/` | **Gitignored** | State, secrets, other generated files |

This ensures:
- **Capabilities are visible** — not hidden like `.git` metadata
- **Secrets stay local** — never accidentally committed
- **State is per-machine** — task DB, caches don't conflict
- **Profile switching is clean** — no git diffs when switching profiles
- **Each dev can use different profiles** — personal `.omni/active-profile`
- **Skills are discoverable** — written directly where providers look for them
