---
title: Commands (Prompt Commands)
description: Define reusable prompt commands with COMMAND.md files.
sidebar:
  order: 5
---

Commands are reusable prompts defined in `commands/<name>/COMMAND.md`. They are distinct from CLI routes; commands are run inside supported AI tools.

## Structure

```
my-capability/
├── capability.toml
└── commands/
    └── review-pr/
        └── COMMAND.md
```

## COMMAND.md format

```markdown
---
name: review-pr
description: Review a pull request
allowed-tools: Bash(git diff:*), Bash(git status:*)
---

Review PR #$1 with priority $2.
```

### Frontmatter fields

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Command name (used as `/command-name`) |
| `description` | Yes | Brief description |
| `allowed-tools` / `allowedTools` | No | Tool allowlist (Bash tool rules) |

### Placeholders

- `$ARGUMENTS` for all arguments
- `$1`, `$2`, ... for positional arguments

### Bash execution

Use `!` to run commands before the prompt:

```markdown
- Current status: !`git status`
```

### File references

Reference files with `@`:

```markdown
Review @src/index.ts for correctness.
```

## Programmatic commands

For dynamic commands, export them from `index.ts`:

```typescript
import type { CapabilityExport, CommandExport } from "@omnidev-ai/core";

const optimizeCommand: CommandExport = {
  commandMd: `---
name: optimize
description: Analyze code for performance issues
allowed-tools: Bash(node --prof:*), Bash(python -m cProfile:*)
---

Analyze $ARGUMENTS and suggest optimizations.
`
};

export default {
  commands: [optimizeCommand]
} satisfies CapabilityExport;
```
