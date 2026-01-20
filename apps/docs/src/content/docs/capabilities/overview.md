---
title: Capabilities Overview
description: What capabilities are and how OmniDev loads them.
sidebar:
  order: 1
---

Capabilities are OmniDev's extension unit. A capability bundles agent behaviors, rules, docs, and commands into a portable package that can be reused across providers.

## Wrap anything into a capability

OmniDev's core power is the ability to take any GitHub repo or local folder containing skills, rules, or prompts and wrap it into a capability. You don't need to rewrite or convert anything—just point to the source and OmniDev handles the rest.

```toml
# Point to any GitHub repo with AI content
[capabilities.sources]
my-tools = "github:user/repo"

# Or a local folder
local-cap = "file://./my-local-capability"
```

After `omnidev sync`, the content is wrapped and available to your configured providers.

## Where capabilities live

OmniDev downloads and manages capabilities in a single location:

```
.omni/capabilities/
```

This folder works like `node_modules`—it's managed by OmniDev and **should not be edited manually**. When you run `omnidev add` or configure capability sources in `omni.toml`, OmniDev downloads and installs capabilities here during `omnidev sync`.

Each capability is identified by a `capability.toml` file at its root.

## Capability content types

A capability can contribute one or more of the following:

- **Skills**: task-oriented procedures loaded by AI agents
- **Rules**: guidelines and constraints merged into instructions
- **Docs**: long-form guidance merged into instructions
- **Commands**: reusable prompts defined in `commands/**/COMMAND.md`
- **CLI commands**: new `omnidev <command>` routes via Stricli
- **Subagents**: specialized agents defined in `subagents/**/SUBAGENT.md`
- **MCP servers**: Model Context Protocol endpoints configured in `omni.toml`
- **Gitignore patterns**: added to `.omni/.gitignore` during sync
- **Sync hooks**: custom setup steps run during `omnidev sync`
- **Claude Code hooks**: automated scripts that run at specific agent lifecycle events

## How content is loaded

OmniDev merges content from two sources:

1. **Static files** under `skills/`, `rules/`, `docs/`, `commands/`, `subagents/`, and `hooks/`
2. **Programmatic exports** from `index.ts`

Programmatic exports take precedence when both are provided (except for hooks, which are currently TOML-only).

## Capability structure

Every capability is a directory with a `capability.toml` file at the root. Everything else is optional.

### Minimal structure

```
my-capability/
├── capability.toml
```

### Typical structure

```
my-capability/
├── capability.toml       # Required metadata
├── index.ts              # Optional programmatic exports
├── cli.ts                # Optional CLI command definitions
├── sync.ts               # Optional sync hook
├── rules/                # Markdown rules
├── docs/                 # Markdown docs
├── skills/               # Skill folders with SKILL.md
├── commands/             # Slash-style commands (COMMAND.md)
├── subagents/            # Specialized agents (SUBAGENT.md)
└── hooks/                # Claude Code hooks (hooks.toml + scripts)
```

## capability.toml

`capability.toml` is required for every capability. OmniDev uses it to identify and validate the capability during discovery.

### Example

```toml
[capability]
id = "testing-guide"
name = "Testing Guide"
version = "1.0.0"
description = "Guidelines and patterns for testing in OmniDev."
```

### Fields

- **id**: unique, kebab-case identifier. Avoid reserved names like `fs`, `path`, `react`, or `typescript`.
- **name**: human-readable title.
- **version**: semantic version string.
- **description**: short summary shown in listings.

## Static vs programmatic

- Use **static files** for content that rarely changes.
- Use **programmatic exports** in `index.ts` for dynamic or generated content.
- You can use both; OmniDev merges them during sync.

### Programmatic exports (index.ts)

```typescript
import type { CapabilityExport } from "@omnidev-ai/core";

export default {
  cliCommands: { /* routes */ },
  docs: [/* DocExport */],
  rules: [/* markdown strings */],
  skills: [/* SkillExport */],
  gitignore: ["mycap/"],
  sync: async () => { /* setup */ }
} satisfies CapabilityExport;
```

Static files under `docs/`, `rules/`, `skills/`, `commands/`, and `subagents/` are discovered automatically and merged with programmatic exports.

---

For a complete guide on creating your own capabilities, see [Creating Capabilities](/advanced/creating-capabilities/).
