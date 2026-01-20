---
title: add
description: Quickly add capabilities and MCP servers.
sidebar:
  order: 4
---

`omnidev add` provides shortcuts for updating `omni.toml` and syncing.

## `omnidev add cap`

Add a capability source and enable it in the active profile.

### GitHub Sources

```bash
omnidev add cap my-cap --github user/repo
```

With a subdirectory:

```bash
omnidev add cap my-cap --github user/repo --path plugins/subdir
```

### Local Sources

Add a capability from a local directory:

```bash
omnidev add cap my-cap --local ./capabilities/my-cap
```

### ID Inference

If you omit the capability ID, it will be inferred automatically:

- **Local sources**: Reads the `id` from `capability.toml`, or uses the directory name
- **GitHub sources**: Uses the repository name or last path segment

```bash
# Infers "skills" from repo name
omnidev add cap --github expo/skills

# Infers "my-cap" from capability.toml or directory name
omnidev add cap --local ./capabilities/my-cap
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
