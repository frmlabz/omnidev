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

## How it is used

When you run `omnidev sync`, OmniDev:

1. Reads `OMNI.md`
2. Generates provider files like `CLAUDE.md` and `AGENTS.md`
3. Injects `@import .omni/instructions.md` so capabilities are included

## Tips

- Keep `OMNI.md` concise and focused on project-wide guidance.
- Put provider-specific details in capabilities instead of duplicating them here.
- Never add file tree structure to your `OMNI.md`. This is generally a core service of every coding agent that they can discover things on their own. File structure is the first thing that will go stale.
