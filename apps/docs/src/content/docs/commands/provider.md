---
title: provider
description: List and manage provider adapters.
sidebar:
  order: 8
---

Manage provider adapters.

## `provider list`

Show available providers and their status.

```bash
omnidev provider list
```

## `provider enable <id>`

Enable a provider adapter.

```bash
omnidev provider enable cursor
```

## `provider disable <id>`

Disable a provider adapter.

```bash
omnidev provider disable cursor
```

---

Supported providers include:

- `claude-code` - Claude Code
- `cursor` - Cursor
- `codex` - Codex
- `opencode` - OpenCode
- `amp` - Amp
