---
title: MCP Servers
description: Configure Model Context Protocol servers as capabilities.
sidebar:
  order: 10
---

OmniDev treats MCP servers as capabilities. Define them in `omni.toml`, then enable them in profiles like any other capability.

## Transport types

| Transport | Use case | Required fields |
| --- | --- | --- |
| `stdio` | Local process (default) | `command` |
| `http` | Remote HTTP server | `url` |
| `sse` | Server-Sent Events (deprecated) | `url` |

## stdio example

```toml
[mcps.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
env = { SOMENAME = "SOMEVALUE", SOMEVALUE = "$SOME_ENV_VALUE" }
```

Optional fields:

- `args`: command arguments
- `cwd`: working directory
- `env`: environment variables

## http example

```toml
[mcps.notion]
transport = "http"
url = "https://mcp.notion.com/mcp"
headers = { Authorization = "Bearer ${API_TOKEN}" }
```

## sse example (deprecated)

```toml
[mcps.legacy]
transport = "sse"
url = "https://example.com/sse"
```

## Enable in a profile

```toml
[profiles.default]
capabilities = ["filesystem", "notion"]
```

## Add via CLI

```bash
omnidev add mcp filesystem --command npx --args "-y @modelcontextprotocol/server-filesystem /path"
```

After changes, run:

```bash
omnidev sync
```

## How it works

When you define `[mcps.name]`, OmniDev:

1. Generates a synthetic capability under `.omni/capabilities/name/`
2. Writes a `capability.toml` with metadata
3. Includes the server in the generated `.mcp.json`

## Environment variables

Use `${VAR}` to reference values from your shell or environment files:

```toml
[mcps.database]
command = "node"
args = ["./mcp-server.js"]
env = { DB_URL = "${DATABASE_URL}" }
```
