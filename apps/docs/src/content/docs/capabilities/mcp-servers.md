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

## Security and versioning notes

MCP servers can see what you send them, and their tool responses can influence downstream behavior. Treat MCP configuration like adding a dependency with network and data access.

### `stdio` (local) servers

- Prefer **pinned versions** for package-based servers. For example, instead of relying on “latest”, include an explicit version in the package spec:
  - `@modelcontextprotocol/server-filesystem@1.2.3`
- If you run a local server from your repo, consider pinning via your lockfile/tooling (e.g., `package.json` + lockfile) instead of `npx` downloading arbitrary versions at runtime.

### `http` (remote) servers

- You generally **cannot pin** the remote server implementation from the client side. Assume it can change at any time.
- Only use remote MCP providers you trust to handle your data securely. A compromised or malicious provider can potentially:
  - exfiltrate sensitive inputs you send to tools,
  - return tool outputs designed to steer behavior in unexpected ways.
- Prefer least-privilege credentials, rotate tokens, and consider isolating MCP usage to environments where data exposure is acceptable.

## stdio example

```toml
[mcps.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
env = { SOMENAME = "SOMEVALUE", SOMEVALUE = "literal-value" }
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
headers = { Authorization = "Bearer your-token-here" }
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

`omni.toml` MCP values are written literally. If you need secret interpolation, define the MCP inside a capability's `capability.toml` and add a gitignored `.env` file next to it. OmniDev resolves `${VAR}` in MCP fields only, with shell environment variables taking precedence over the capability-local `.env`.

This is separate from skill interpolation:

- MCP config uses `${VAR}`
- skill content uses `{OMNIDEV_VAR}`

```toml
[mcp]
command = "npx"
args = ["mcp-remote", "https://mcp.riskos.socure.com/mcp", "--header", "Authorization: Basic ${SOCURE_AUTH}"]
```

```dotenv
SOCURE_AUTH=your-base64-value
```
