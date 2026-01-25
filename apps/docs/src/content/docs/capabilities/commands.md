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

### OpenCode-specific fields

| Field | Description |
| --- | --- |
| `agent` | Agent to delegate command execution to |
| `modelId` | Full model ID (e.g., `anthropic/claude-sonnet-4`) |

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

## Provider Output

### Claude Code

Claude Code does not have native command support. Commands are automatically transformed into skills and written to `.claude/skills/<command-name>/SKILL.md`:

```markdown
---
name: review-pr
description: "Review a pull request"
allowed_tools: "Bash(git diff:*), Bash(git status:*)"
---

Review PR #$1 with priority $2.
```

Users can invoke commands using Claude's skill system with `/review-pr`.

### Codex

Codex does not have native command support. Commands are automatically transformed into skills and written to `.codex/skills/<command-name>/SKILL.md`:

```markdown
---
name: review-pr
description: "Review a pull request"
allowed_tools: "Bash(git diff:*), Bash(git status:*)"
---

Review PR #$1 with priority $2.
```

Users can invoke commands using Codex's skill system with `/review-pr`.

### OpenCode

Commands are written to `.opencode/commands/<name>.md`:

```markdown
---
description: "Review a pull request"
---

Review PR #$1 with priority $2.
```

If `agent` or `modelId` are specified, they will be included:

```markdown
---
description: "Review a pull request"
model: anthropic/claude-sonnet-4
agent: code-reviewer
---

Review PR #$1 with priority $2.
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
