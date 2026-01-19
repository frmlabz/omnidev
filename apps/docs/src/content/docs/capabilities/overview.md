---
title: Capabilities Overview
description: What capabilities are and how OmniDev loads them.
sidebar:
  order: 1
---

Capabilities are OmniDev's extension unit. A capability bundles agent behaviors, rules, docs, and commands into a portable package that can be reused across providers.

## Where capabilities live

OmniDev discovers capabilities in these locations:

- `.omni/capabilities/` (downloaded or local sources)
- `capabilities/` (optional, project-local development)

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
- **Type hints**: optional `types.d.ts` for editor/LLM hints

## How content is loaded

OmniDev merges content from two sources:

1. **Static files** under `skills/`, `rules/`, `docs/`, `commands/`, and `subagents/`
2. **Programmatic exports** from `index.ts`

Programmatic exports take precedence when both are provided.
