---
title: sync
description: Fetch capability sources and regenerate provider files.
sidebar:
  order: 2
---

Fetch capability sources and regenerate provider files.

## Usage

```bash
omnidev sync
```

## What it does

1. Downloads/updates capabilities from configured sources
2. Resolves capability dependencies
3. Generates provider-specific files (`CLAUDE.md`, `AGENTS.md`, etc.)
4. Runs any sync hooks defined by capabilities

Run `omnidev sync` after:

- Changing `omni.toml` configuration
- Enabling or disabling capabilities
- Switching profiles
- Updating capability sources
