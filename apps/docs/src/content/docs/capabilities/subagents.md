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
