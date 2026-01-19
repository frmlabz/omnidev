---
title: Capability Structure
description: Required files and optional folders for a capability.
sidebar:
  order: 2
---

Every capability is a directory with a `capability.toml` file at the root. Everything else is optional and depends on what you want the capability to provide.

## Minimal structure

```
my-capability/
├── capability.toml
```

## Typical structure

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
├── hooks/                # Claude Code hooks (hooks.toml + scripts)
├── types.d.ts            # Optional type hints
└── .gitignore            # Optional (capability-specific)
```

## Static vs programmatic

- Use **static files** for content that rarely changes.
- Use **programmatic exports** in `index.ts` for dynamic or generated content.
- You can use both; OmniDev merges them during sync.

## Programmatic exports (index.ts)

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
