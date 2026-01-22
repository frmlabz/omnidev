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

## Version warnings

During sync, you may see warnings about version issues:

```
Syncing...
  ✓ my-cap
  ✓ other-cap

  ! third-cap: no version specified, defaulting to latest
```

| Warning | Meaning |
|---------|---------|
| `no version specified, defaulting to latest` | Source config missing `version` field |
| `version unchanged but content changed` | Repository updated but capability version stayed same |

To resolve, consider adding explicit versions to your capability sources:

```toml
[capabilities.sources]
my-cap = { source = "github:user/repo", version = "v1.0.0" }
```

See [Capability Sources](../configuration/capability-sources) for more details.
