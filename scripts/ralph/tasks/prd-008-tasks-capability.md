# PRD-008: Tasks Capability

**Status:** Ready  
**Priority:** 8 (Capability - After MCP server)  
**Estimated Effort:** Large

---

## Introduction / Overview

Implement the built-in `tasks` capability that demonstrates all OmniDev extension points. This capability provides task management functionality that LLMs can use to track work progress. It includes sandbox tools, CLI commands, skills, and rules - serving as both useful functionality and a reference implementation.

---

## Goals

- Implement task management sandbox tools (create, list, get, update, complete)
- Implement plan management tools (planGet, planSet)
- Create CLI commands (omnidev tasks list, add, complete, board)
- Create task-management skill following Agent Skills spec
- Create task-workflow rules
- Store tasks in `.omni/state/tasks.json`
- Provide TypeScript type definitions for LLM consumption

---

## User Stories

### US-001: Create Capability Structure

**Description:** As a developer, I need the tasks capability scaffolded with proper structure.

**Acceptance Criteria:**
- [ ] `capabilities/tasks/capability.toml` with metadata
- [ ] `capabilities/tasks/package.json` with dependencies
- [ ] `capabilities/tasks/index.ts` as entry point
- [ ] `capabilities/tasks/definition.md` with description
- [ ] Capability is discovered by the loader
- [ ] Typecheck passes

---

### US-002: Implement Task Data Model

**Description:** As a developer, I need a task data model so that tasks can be stored and managed.

**Acceptance Criteria:**
- [ ] `Task` interface with id, title, description, status, tags, timestamps
- [ ] `Status` type: 'todo' | 'in_progress' | 'blocked' | 'done'
- [ ] `Plan` interface for multi-step plans
- [ ] Types exported from capability
- [ ] Typecheck passes

---

### US-003: Implement Task Storage

**Description:** As a developer, I need task persistence so that tasks survive server restarts.

**Acceptance Criteria:**
- [ ] Tasks stored in `.omni/state/tasks.json`
- [ ] `loadTasks` function reads from file
- [ ] `saveTasks` function writes to file
- [ ] File is created if it doesn't exist
- [ ] Tests cover storage scenarios
- [ ] Typecheck passes

---

### US-004: Implement Sandbox Tools

**Description:** As an AI agent, I need task management functions so that I can track work.

**Acceptance Criteria:**
- [ ] `create(title, description?, tags?)` - creates task, returns id
- [ ] `list(status?)` - lists tasks, optionally filtered
- [ ] `get(taskId)` - gets single task
- [ ] `update(taskId, fields)` - updates task fields
- [ ] `complete(taskId)` - marks task as done
- [ ] `planGet()` - gets current plan
- [ ] `planSet(steps)` - sets plan steps
- [ ] All functions exported from index.ts
- [ ] Tests cover all tools
- [ ] Typecheck passes

---

### US-005: Create CLI Commands

**Description:** As a developer, I need CLI commands so that I can manage tasks from the terminal.

**Acceptance Criteria:**
- [ ] `omnidev tasks list` - shows all tasks
- [ ] `omnidev tasks add <title>` - creates new task
- [ ] `omnidev tasks show <id>` - shows task details
- [ ] `omnidev tasks start <id>` - marks task in_progress
- [ ] `omnidev tasks complete <id>` - marks task done
- [ ] `omnidev tasks block <id>` - marks task blocked
- [ ] Commands use cliCommands export pattern
- [ ] Tests cover CLI commands
- [ ] Typecheck passes

---

### US-006: Create Task Management Skill

**Description:** As an AI agent, I need a task management skill so that I know how to use tasks effectively.

**Acceptance Criteria:**
- [ ] `skills/task-management/SKILL.md` exists
- [ ] YAML frontmatter with name and description
- [ ] Instructions for maintaining plans
- [ ] Instructions for status management
- [ ] Skill is discovered by capability loader
- [ ] Typecheck passes

---

### US-007: Create Task Workflow Rules

**Description:** As an AI agent, I need task workflow rules so that I follow best practices.

**Acceptance Criteria:**
- [ ] `rules/task-workflow.md` exists
- [ ] Rules for checking tasks before starting work
- [ ] Rules for keeping one task in_progress
- [ ] Rules for updating status as work progresses
- [ ] Rules are discovered by capability loader
- [ ] Typecheck passes

---

### US-008: Create Type Definitions

**Description:** As an AI agent, I need type definitions so that I can write correct code.

**Acceptance Criteria:**
- [ ] `types.d.ts` file exists in capability
- [ ] All exported functions have type signatures
- [ ] All interfaces are documented
- [ ] Types are included in `omni_query` response
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** Tasks must persist across server restarts
- **FR-2:** Only one task may be `in_progress` at a time (validated in skill/rules)
- **FR-3:** Task IDs must be unique (use nanoid or similar)
- **FR-4:** All task operations must be atomic (no partial writes)
- **FR-5:** CLI commands must import from `@omnidev/core` for shared logic
- **FR-6:** Skills must follow Agent Skills spec format
- **FR-7:** Type definitions must be accurate for LLM code generation

---

## Non-Goals (Out of Scope)

- ❌ No TUI views (OpenTUI) - future feature
- ❌ No subtasks or task hierarchy
- ❌ No task assignments or multiple users
- ❌ No due dates or reminders
- ❌ No task search/filtering beyond status

---

## Technical Considerations

### Capability Config (`capabilities/tasks/capability.toml`)

```toml
[capability]
id = "tasks"
name = "Task Manager"
version = "0.1.0"
description = "Built-in task and plan management for AI agents"

[exports]
module = "tasks"
```

### Task Types (`capabilities/tasks/types.ts`)

```typescript
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

export interface PlanStep {
  id: string;
  description: string;
  status: Status;
}

export interface Plan {
  steps: PlanStep[];
  updatedAt: number;
}

export interface TaskStore {
  tasks: Task[];
  plan: Plan | null;
}
```

### Storage (`capabilities/tasks/storage.ts`)

```typescript
import { existsSync, mkdirSync } from 'fs';
import type { TaskStore } from './types';

const STORAGE_PATH = '.omni/state/tasks.json';

export async function loadStore(): Promise<TaskStore> {
  if (!existsSync(STORAGE_PATH)) {
    return { tasks: [], plan: null };
  }

  try {
    const content = await Bun.file(STORAGE_PATH).text();
    return JSON.parse(content);
  } catch {
    return { tasks: [], plan: null };
  }
}

export async function saveStore(store: TaskStore): Promise<void> {
  mkdirSync('.omni/state', { recursive: true });
  await Bun.write(STORAGE_PATH, JSON.stringify(store, null, 2));
}
```

### Sandbox Tools (`capabilities/tasks/tools/taskManager.ts`)

```typescript
import { nanoid } from 'nanoid';
import { loadStore, saveStore } from '../storage';
import type { Task, Status, PlanStep } from '../types';

export async function create(
  title: string,
  description?: string | null,
  tags?: string[]
): Promise<string> {
  const store = await loadStore();
  
  const task: Task = {
    id: nanoid(8),
    title,
    description: description ?? null,
    status: 'todo',
    tags: tags ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  store.tasks.push(task);
  await saveStore(store);
  
  return task.id;
}

export async function list(status?: Status): Promise<Task[]> {
  const store = await loadStore();
  
  if (status) {
    return store.tasks.filter(t => t.status === status);
  }
  
  return store.tasks;
}

export async function get(taskId: string): Promise<Task> {
  const store = await loadStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  return task;
}

export async function update(
  taskId: string,
  fields: Partial<Omit<Task, 'id' | 'createdAt'>>
): Promise<Task> {
  const store = await loadStore();
  const index = store.tasks.findIndex(t => t.id === taskId);
  
  if (index === -1) {
    throw new Error(`Task not found: ${taskId}`);
  }

  store.tasks[index] = {
    ...store.tasks[index],
    ...fields,
    updatedAt: Date.now(),
  };

  await saveStore(store);
  return store.tasks[index];
}

export async function complete(taskId: string): Promise<Task> {
  return update(taskId, { status: 'done' });
}

export async function planGet(): Promise<PlanStep[] | null> {
  const store = await loadStore();
  return store.plan?.steps ?? null;
}

export async function planSet(steps: PlanStep[]): Promise<void> {
  const store = await loadStore();
  
  store.plan = {
    steps: steps.map(s => ({
      ...s,
      id: s.id || nanoid(8),
    })),
    updatedAt: Date.now(),
  };

  await saveStore(store);
}
```

### Capability Entry Point (`capabilities/tasks/index.ts`)

```typescript
// Re-export types
export type { Task, Status, PlanStep, Plan } from './types';

// Export sandbox tools
export {
  create,
  list,
  get,
  update,
  complete,
  planGet,
  planSet,
} from './tools/taskManager';

// Export CLI commands
export { cliCommands } from './cli/commands';
```

### Skill File (`capabilities/tasks/skills/task-management/SKILL.md`)

```markdown
---
name: task-management
description: "Maintain an explicit plan and update tasks as work progresses. Use when working on multi-step tasks or when progress needs to be visible."
---

## Instructions

### Before Starting Work

1. Check the current task list with `tasks.list()`
2. If no tasks exist, create them with `tasks.create()`
3. Review the plan with `tasks.planGet()`

### During Work

1. Keep exactly ONE task `in_progress` at a time
2. When starting a task: `tasks.update(taskId, { status: 'in_progress' })`
3. When blocked: `tasks.update(taskId, { status: 'blocked' })`
4. When finished: `tasks.complete(taskId)`

### Maintaining Plans

1. For multi-step work, set a plan: `tasks.planSet([{ description: '...', status: 'todo' }])`
2. Update plan step status as you progress
3. Only one plan step should be `in_progress` at a time

### Task Creation Guidelines

- Use clear, actionable titles
- Add descriptions for complex tasks
- Use tags for categorization

### Example Code

\`\`\`typescript
import * as tasks from 'tasks';

export async function main(): Promise<number> {
  // Check current tasks
  const existing = await tasks.list('in_progress');
  if (existing.length > 0) {
    console.log('Already working on:', existing[0].title);
    return 0;
  }

  // Create and start a task
  const id = await tasks.create('Implement feature X', 'Add the new functionality');
  await tasks.update(id, { status: 'in_progress' });

  // Do work...

  // Complete the task
  await tasks.complete(id);
  return 0;
}
\`\`\`
```

### Rules File (`capabilities/tasks/rules/task-workflow.md`)

```markdown
# Task Workflow Rules

## Before Starting New Work

- Always check the current task list before creating new tasks
- Review what's `in_progress` before starting something new
- Don't create duplicate tasks for the same work

## Task Status Management

- Keep exactly ONE task `in_progress` at a time
- Complete the current task before starting a new one
- Use `blocked` status when waiting on external factors
- Mark tasks `done` as soon as they're complete

## Progress Updates

- Update task status immediately when it changes
- Add notes to tasks when status changes for non-obvious reasons
- Keep the plan synchronized with actual progress

## Task Quality

- Use clear, specific titles (not "Fix bug" but "Fix login redirect loop")
- Add descriptions for tasks that need context
- Use consistent tags across related tasks
```

### Type Definitions (`capabilities/tasks/types.d.ts`)

```typescript
// Type definitions for the tasks capability
// These are returned by omni_query when include_types is true

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

export interface PlanStep {
  id: string;
  description: string;
  status: Status;
}

/**
 * Create a new task
 * @param title - Task title (required)
 * @param description - Optional description
 * @param tags - Optional array of tags
 * @returns The new task's ID
 */
export function create(
  title: string,
  description?: string | null,
  tags?: string[]
): Promise<string>;

/**
 * List all tasks, optionally filtered by status
 * @param status - Optional status filter
 * @returns Array of tasks
 */
export function list(status?: Status): Promise<Task[]>;

/**
 * Get a single task by ID
 * @param taskId - The task ID
 * @returns The task object
 * @throws If task not found
 */
export function get(taskId: string): Promise<Task>;

/**
 * Update a task's fields
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
 * @returns Array of plan steps, or null if no plan
 */
export function planGet(): Promise<PlanStep[] | null>;

/**
 * Set the plan steps
 * @param steps - Array of plan steps
 */
export function planSet(steps: PlanStep[]): Promise<void>;
```

### Directory Structure

```
capabilities/tasks/
├── capability.toml
├── package.json
├── index.ts
├── definition.md
├── types.ts
├── types.d.ts
├── storage.ts
├── tools/
│   └── taskManager.ts
├── cli/
│   └── commands.ts
├── skills/
│   └── task-management/
│       └── SKILL.md
└── rules/
    └── task-workflow.md
```

---

## Touchpoints

Files to create:

### Tasks Capability
- `capabilities/tasks/capability.toml` - Config (CREATE)
- `capabilities/tasks/package.json` - Package (CREATE)
- `capabilities/tasks/index.ts` - Entry point (CREATE)
- `capabilities/tasks/definition.md` - Description (CREATE)
- `capabilities/tasks/types.ts` - TypeScript types (CREATE)
- `capabilities/tasks/types.d.ts` - Type definitions for LLM (CREATE)
- `capabilities/tasks/storage.ts` - Persistence (CREATE)
- `capabilities/tasks/tools/taskManager.ts` - Sandbox tools (CREATE)
- `capabilities/tasks/cli/commands.ts` - CLI commands (CREATE)
- `capabilities/tasks/skills/task-management/SKILL.md` - Skill (CREATE)
- `capabilities/tasks/rules/task-workflow.md` - Rules (CREATE)

### Tests
- `capabilities/tasks/tools/taskManager.test.ts` (CREATE)
- `capabilities/tasks/storage.test.ts` (CREATE)

---

## Dependencies

- ✅ PRD-001: Bun Monorepo Setup
- ✅ PRD-002: Code Quality Infrastructure
- ✅ PRD-003: Testing Infrastructure
- ✅ PRD-004: Core Types and Config
- ✅ PRD-005: Capability System
- ✅ PRD-006: CLI Package
- ✅ PRD-007: MCP Server Package
- `nanoid`: ID generation (to be installed)

---

## Success Metrics

- All sandbox tools work correctly
- CLI commands execute successfully
- Skill is discovered and included in sync
- Rules are discovered and included in sync
- Type definitions are included in `omni_query`
- Tasks persist across server restarts
- 70%+ test coverage on task tools

---

## Implementation Notes

### Suggested Implementation Order

1. **Create capability structure** - toml, package.json
2. **Implement types** - Task, Status, Plan interfaces
3. **Implement storage** - load/save functions
4. **Implement sandbox tools** - task CRUD operations
5. **Implement CLI commands** - task management commands
6. **Create skill** - task-management SKILL.md
7. **Create rules** - task-workflow.md
8. **Create type definitions** - types.d.ts
9. **Write tests** - comprehensive coverage

### Validation Commands

```bash
# Run capability tests
bun test capabilities/tasks

# Test CLI commands
bun run packages/cli/src/index.ts tasks list
bun run packages/cli/src/index.ts tasks add "Test task"

# Verify skill is discovered
bun run packages/cli/src/index.ts agents sync
cat .claude/skills/task-management/SKILL.md
```

---

## Codebase Patterns

Ralph should follow these patterns:

- Use `nanoid` for generating short, unique IDs
- Store state in `.omni/state/` directory
- Export all public APIs from `index.ts`
- Use async/await for all file operations
- Follow Agent Skills spec for SKILL.md format

---

