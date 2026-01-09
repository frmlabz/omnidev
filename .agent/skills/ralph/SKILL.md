---
name: ralph
description: "Create prd.json orchestration file that links to detailed task files. Use when you have tasks in .work/tasks/ and need to create a Ralph execution plan. Triggers on: create ralph prd, orchestrate tasks, link tasks to prd, ralph json."
---

# Ralph PRD Orchestrator

Creates `prd.json` orchestration files that link to detailed task files in `scripts/ralph/tasks/`.

---

## The Job

1. Identify task files in `.work/tasks/backlog/` or `.work/tasks/in-progress/`
2. Create `scripts/ralph/prd.json` with user stories that **link to** these task files
3. Break large tasks into appropriately-scoped stories

---

## Key Principle: Tasks Have the Details

Task files contain the real requirements:
- User journeys, UX guidelines
- System behaviors, edge cases
- API contracts, data models
- Touchpoints (files to modify)
- Acceptance criteria

The PRD is just an **orchestration layer** - it tells Ralph what order to work in and what scope each story covers.

---

## Output Format

```json
{
  "project": "Nutribox",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "Brief description of what this PRD covers",
  "userStories": [
    {
      "id": "US-001",
      "title": "Short story title",
      "taskFile": ".work/tasks/backlog/XX-task-name.md",
      "scope": "What part of the task to implement",
      "acceptanceCriteria": [
        "Story-specific criteria (subset of task)",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## Story Sizing: The Number One Rule

**Each story must be completable in ONE Ralph iteration (one context window).**

Ralph reads the task file for context, but if the task is too big, it won't finish in one iteration.

### Right-sized scopes:
- "Schema changes only" - just database
- "API endpoints only" - backend service + router
- "Mobile frontend" - just the UI
- "Full task" - only for small tasks

### Breaking down large tasks:

**Original task:** 30-mobile-tomorrow-delivery-modification.md

**Split into stories:**
1. US-001: Schema changes (scope: "Schema Changes section")
2. US-002: API endpoints (scope: "API Endpoints + System Behaviors")
3. US-003: Mobile UI (scope: "UX Guidelines + User Journey")

Each story links to the SAME task file but with different scopes.

---

## Story Ordering: Dependencies First

Stories execute in priority order. Earlier stories must not depend on later ones.

**Correct order:**
1. Schema/database changes (priority: 1)
2. Backend API (priority: 2)
3. Frontend UI (priority: 3)

---

## Scope Field Examples

The `scope` field tells Ralph what part of the task file to focus on:

```json
// Small task - do everything
"scope": "Full task"

// Just the database part
"scope": "Schema changes only (see 'Schema Changes' section)"

// Backend only
"scope": "API endpoints (see 'Data & Contracts' and 'System Behaviors' sections)"

// Frontend only
"scope": "Mobile frontend (see 'UX Guidelines' and 'User Journey' sections)"

// Specific acceptance criteria
"scope": "First 3 acceptance criteria only"
```

---

## Acceptance Criteria in Stories

Story acceptance criteria should be:
1. A **subset** of the task's full acceptance criteria
2. Specific to this story's scope
3. Always include "Typecheck passes"
4. Include "Verify in browser using Playwrighter MCP" for UI stories

Don't copy all task criteria - just the ones relevant to this story's scope.

---

## Example

**Task file:** `.work/tasks/backlog/30-mobile-tomorrow-delivery-modification.md`

**Resulting PRD stories:**

```json
{
  "project": "Nutribox",
  "branchName": "ralph/delivery-modification",
  "description": "Mobile tomorrow delivery modification feature",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add delivery override columns to database",
      "taskFile": ".work/tasks/backlog/30-mobile-tomorrow-delivery-modification.md",
      "scope": "Schema changes only (see 'Schema Changes' section)",
      "acceptanceCriteria": [
        "Add override columns as specified in task",
        "Run just db-migrate successfully",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "Add delivery modification API endpoints",
      "taskFile": ".work/tasks/backlog/30-mobile-tomorrow-delivery-modification.md",
      "scope": "API endpoints (see 'API Endpoints' and 'System Behaviors' sections)",
      "acceptanceCriteria": [
        "Implement all endpoints from task",
        "Cutoff enforcement server-side",
        "Typecheck passes"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-003",
      "title": "Mobile UI for delivery modification",
      "taskFile": ".work/tasks/backlog/30-mobile-tomorrow-delivery-modification.md",
      "scope": "Mobile frontend (see 'UX Guidelines' and 'User Journey' sections)",
      "acceptanceCriteria": [
        "All UI requirements from task met",
        "Typecheck passes",
        "Verify in browser using Playwrighter MCP"
      ],
      "priority": 3,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## Handling Multiple Tasks

If orchestrating multiple task files:

1. Order tasks by dependencies (foundation first)
2. Break each task into appropriately-scoped stories
3. Interleave if needed (e.g., all schema changes first across tasks)

```json
{
  "userStories": [
    { "id": "US-001", "taskFile": ".work/tasks/.../task-a.md", "scope": "Schema" },
    { "id": "US-002", "taskFile": ".work/tasks/.../task-b.md", "scope": "Schema" },
    { "id": "US-003", "taskFile": ".work/tasks/.../task-a.md", "scope": "API" },
    { "id": "US-004", "taskFile": ".work/tasks/.../task-b.md", "scope": "API" }
  ]
}
```

---

## Checklist Before Saving

- [ ] Each story links to a task file via `taskFile`
- [ ] Each story has a clear `scope`
- [ ] Stories are small enough for one iteration
- [ ] Stories are ordered by dependency
- [ ] UI stories have "Verify in browser using Playwrighter MCP"
- [ ] All stories have "Typecheck passes"
