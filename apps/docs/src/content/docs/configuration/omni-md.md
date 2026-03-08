---
title: OMNI.md
description: Write project instructions once, generate provider files.
sidebar:
  order: 3
---

`OMNI.md` is your project’s instruction source of truth. OmniDev uses it to generate provider-specific instruction files during `omnidev sync`.

## Example

```markdown
# My Project

## Project Description
A web application for managing tasks.

## Conventions
- Use TypeScript strict mode
- Follow the existing code style
```

## Provider-specific blocks

`OMNI.md` can also scope instructions to a provider:

```markdown
# My Project

Shared instructions for every provider.

<provider.claude>
Only include this when generating Claude instructions.
</provider.claude>

<provider.codex>
Only include this when generating Codex instructions.
</provider.codex>
```

Supported names:
- `claude` and `claude-code` are equivalent
- `codex`
- `cursor`
- `opencode`

Provider names are normalized internally, so `claude` and `claude-code` behave identically across `OMNI.md` and `capability.providers`.

## How it is used

When you run `omnidev sync`, OmniDev:

1. Reads `OMNI.md`
2. Generates provider files like `CLAUDE.md` and `AGENTS.md`
3. Embeds capability rules and docs directly into the generated files

## Current limitation

Cursor currently shares `CLAUDE.md` with Claude Code. That means Cursor-specific `OMNI.md` blocks are not rendered separately while both providers use the same instruction file surface.

## Tips

- Keep `OMNI.md` concise and focused on project-wide guidance.
- Use provider blocks sparingly. Shared instructions are still the default.
- Never add file tree structure to your `OMNI.md`. This is generally a core service of every coding agent that they can discover things on their own. File structure is the first thing that will go stale.
