---
title: Subagents
description: Define specialized agents with SUBAGENT.md.
sidebar:
  order: 9
---

Subagents are specialized AI agents that can be invoked for focused tasks. Define them in `subagents/<name>/SUBAGENT.md`.

## Structure

```
my-capability/
├── capability.toml
└── subagents/
    └── code-reviewer/
        └── SUBAGENT.md
```

## SUBAGENT.md format

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep, Bash
model: inherit
permissionMode: default
---

You are a senior code reviewer ensuring high standards.
```

### Frontmatter fields

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Unique identifier (lowercase, hyphenated) |
| `description` | Yes | When to invoke this subagent |
| `tools` | No | Allowlist of tools |
| `disallowedTools` | No | Tools to remove from allowlist |
| `model` | No | `sonnet`, `opus`, `haiku`, or `inherit` |
| `permissionMode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `skills` | No | Skills to preload for this agent |
| `hooks` | No | Lifecycle hooks scoped to this subagent |

### OpenCode-specific fields

These fields are only used when syncing to OpenCode:

| Field | Description |
| --- | --- |
| `mode` | `primary` (runs in main context) or `subagent` (spawned) |
| `temperature` | Model sampling temperature |
| `maxSteps` | Maximum turns before stopping |
| `hidden` | Hide this agent from listings |
| `toolPermissions` | Object with tool names as keys and boolean values |
| `permissions` | Granular permissions: `edit`, `bash`, `webfetch` |
| `modelId` | Full model ID (e.g., `anthropic/claude-sonnet-4`) |

## Provider Output

### Claude Code

Subagents are written to `.claude/agents/<name>.md`:

```markdown
---
name: code-reviewer
description: "Reviews code for quality and best practices"
tools: Read, Glob, Grep
model: sonnet
---

You are a senior code reviewer ensuring high standards.
```

### OpenCode

Subagents are written to `.opencode/agents/<name>.md` with OpenCode-specific formatting:

```markdown
---
description: "Reviews code for quality and best practices"
model: anthropic/claude-sonnet-4
tools:
  read: true
  glob: true
  grep: true
---

You are a senior code reviewer ensuring high standards.
```

Model names are automatically mapped:
- `sonnet` → `anthropic/claude-sonnet-4`
- `opus` → `anthropic/claude-opus-4`
- `haiku` → `anthropic/claude-haiku-3-5`

Permission modes are also mapped:
- `acceptEdits` → `{ edit: 'allow', bash: { '*': 'ask' } }`
- `dontAsk` → `{ edit: 'allow', bash: { '*': 'allow' } }`
- `plan` → `{ edit: 'deny', bash: { '*': 'deny' } }`

## Programmatic subagents

```typescript
import type { CapabilityExport, SubagentExport } from "@omnidev-ai/core";

const reviewer: SubagentExport = {
  subagentMd: `---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a specialized reviewer...`
};

export default {
  subagents: [reviewer]
} satisfies CapabilityExport;
```
