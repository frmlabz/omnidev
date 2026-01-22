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

### Pinning to a version

Use `--pin` to automatically detect and pin to the current version:

```bash
omnidev add cap my-cap --github user/repo --pin
```

This will:
1. Clone the repository to detect the version
2. Check `capability.toml` for a version field
3. Fall back to the current commit hash if no version is found

The resulting entry in `omni.toml` will look like:

```toml
[capabilities.sources]
my-cap = { source = "github:user/repo", version = "v1.0.0" }
```

Without `--pin`, the default `version = "latest"` is used.

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

Tip: for package-based MCP servers, prefer pinning an explicit version (e.g., `@modelcontextprotocol/server-filesystem@1.2.3`) rather than relying on “latest”.

HTTP transport:

```bash
omnidev add mcp notion --transport http --url https://mcp.notion.com/mcp
```

Warning: for remote `http` MCP servers, you generally can’t pin the server implementation from the client side. Only use providers you trust to handle your data securely.

After adding, OmniDev automatically runs `omnidev sync`.
