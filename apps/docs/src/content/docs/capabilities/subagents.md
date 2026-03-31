---
title: Subagents
description: Define specialized agents with agent.toml and prompt.md.
sidebar:
  order: 9
---

Subagents are specialized AI agents that OmniDev can materialize for Claude Code, Cursor, Codex, and OpenCode.

## Preferred format

Define subagents in `subagents/<name>/agent.toml` and `subagents/<name>/prompt.md`:

```text
my-capability/
├── capability.toml
└── subagents/
    └── code-reviewer/
        ├── agent.toml
        └── prompt.md
```

### `agent.toml`

```toml
name = "code-reviewer"
description = "Reviews code for quality and best practices"

[claude]
tools = ["Read", "Glob", "Grep"]
model = "sonnet"
permission_mode = "acceptEdits"

[codex]
model = "gpt-5.4"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
nickname_candidates = ["Atlas", "Delta"]
```

### `prompt.md`

```md
You are a senior code reviewer.
Focus on correctness, regressions, and missing tests.
```

## Manifest fields

### Shared

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Unique identifier used for the generated agent file |
| `description` | Yes | Human-facing guidance for when the subagent should be used |

### `[claude]`

| Field | Required | Description |
| --- | --- | --- |
| `tools` | No | Tool allowlist |
| `disallowed_tools` | No | Tools to remove from the allowlist |
| `model` | No | `sonnet`, `opus`, `haiku`, or `inherit` |
| `permission_mode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `skills` | No | Skills to preload for Claude-compatible providers |
| `hooks` | No | Claude-scoped lifecycle hooks |

### `[codex]`

| Field | Required | Description |
| --- | --- | --- |
| `model` | No | Full Codex model ID, for example `gpt-5.4` |
| `model_reasoning_effort` | No | `low`, `medium`, `high`, or `xhigh` |
| `sandbox_mode` | No | `read-only`, `workspace-write`, or `danger-full-access` |
| `nickname_candidates` | No | Optional display nicknames for spawned Codex agents |

## Provider output

### Claude Code

OmniDev writes `.claude/agents/<name>.md` and maps `[claude]` settings into Claude's YAML frontmatter.

### Cursor

OmniDev writes `.cursor/agents/<name>.md`. Cursor derives its agent settings from the Claude-compatible fields.

### Codex

OmniDev writes `.codex/agents/<name>.toml` with the required Codex fields:

```toml
name = "code-reviewer"
description = "Reviews code for quality and best practices"
developer_instructions = "You are a senior code reviewer.\nFocus on correctness, regressions, and missing tests."
model = "gpt-5.4"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
nickname_candidates = ["Atlas", "Delta"]
```

### OpenCode

OmniDev writes `.opencode/agents/<name>.md`. OpenCode continues deriving its defaults from the Claude-compatible fields, including model and permission mappings.

## Programmatic subagents

Preferred programmatic shape:

```typescript
import type { CapabilityExport, SubagentExport } from "@omnidev-ai/core";

const reviewer: SubagentExport = {
  agentToml: `name = "code-reviewer"
description = "Reviews code for quality and best practices"

[claude]
tools = ["Read", "Glob", "Grep"]

[codex]
model = "gpt-5.4"`,
  promptMd: "Review the diff and report concrete defects."
};

export default {
  subagents: [reviewer]
} satisfies CapabilityExport;
```

## Legacy format

OmniDev still reads legacy `SUBAGENT.md` and `AGENT.md` files during migration, but they are deprecated.

- Preferred format: `agent.toml` + `prompt.md`
- When both formats exist for the same agent, OmniDev prefers `agent.toml` + `prompt.md`
- Deprecation tracking lives in the repository root `DEPRECATIONS.md`
