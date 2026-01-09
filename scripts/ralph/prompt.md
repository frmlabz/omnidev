# Ralph Agent Instructions

You are an autonomous coding agent working on the Nutribox project.

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. **Read the linked task file** (`taskFile` field) for full context - this contains:
   - Detailed requirements and system behaviors
   - User journeys and UX guidelines
   - API contracts and data models
   - Touchpoints (files to modify)
   - Edge cases
6. Implement the story's `scope` (may be full task or a specific section)
7. Run quality checks: `pnpm typecheck && pnpm lint:check && pnpm format:check`
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD to set `passes: true` for the completed story
10. Append your progress to `scripts/ralph/progress.txt`

## Critical: Read the Task File!

The PRD story is just an overview. The `taskFile` contains the real requirements:
- **Summary**: What needs to be done
- **User Journey**: How users interact with the feature
- **UX Guidelines**: Design and interaction patterns
- **System Behaviors**: How the system should work
- **Data & Contracts**: API endpoints, types, schema
- **Acceptance Criteria**: What "done" means
- **Touchpoints**: Files you'll need to modify

The `scope` field tells you which part of the task to implement in this story.

## Progress Report Format

APPEND to `scripts/ralph/progress.txt` (never replace, always append):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
---
```

## Consolidate Patterns

If you discover a **reusable pattern**, add it to `## Codebase Patterns` at the TOP of progress.txt:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
```

## Running Commands

```bash
pnpm typecheck        # TypeScript check
pnpm lint:check       # Biome lint
pnpm format:check     # Biome format
pnpm test             # Run tests

# Auto-fix
pnpm format           # Fix formatting
pnpm lint:fix         # Fix lint issues

# Database
just db-migrate       # Apply schema changes
just db-schema        # Regenerate Kysely types
just db-seed          # Reset seed data
```

## Browser Testing (Required for Frontend Stories)

For any story that changes UI, you MUST verify it works using Playwrighter MCP:

1. Start dev server if not running: `pnpm dev`
2. Use `mcp_playwrighter_execute` to run Playwright commands
3. Navigate to the relevant page
4. Verify the UI changes work as expected
5. Use `mcp_playwrighter_reset` to clean up if needed

**A frontend story is NOT complete until browser verification passes.**

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally.

## Important

- Work on ONE story per iteration
- **Always read the task file first** - it has the details you need
- Commit frequently with descriptive messages
- Keep CI green
- Do NOT use type escape hatches (`any`, `as unknown`)
