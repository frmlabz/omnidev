---
title: Add Commands
description: Quickly add capabilities and MCP servers.
sidebar:
  order: 5
---

`omnidev add` provides shortcuts for updating `omni.toml` and syncing.

## `omnidev add cap`

Add a capability source and enable it in the active profile.

```bash
omnidev add cap my-cap --github user/repo
```

With a subdirectory:

```bash
omnidev add cap my-cap --github user/repo --path plugins/subdir
```

## `omnidev add mcp`

Add an MCP server and enable it.

```bash
omnidev add mcp filesystem --command npx --args "-y @modelcontextprotocol/server-filesystem /path"
```

HTTP transport:

```bash
omnidev add mcp notion --transport http --url https://mcp.notion.com/mcp
```

After adding, OmniDev automatically runs `omnidev sync`.
