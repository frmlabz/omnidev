---
title: omni.toml Reference
description: Complete reference for all omni.toml configuration options.
sidebar:
  order: 2
---

This page documents all available configuration options in `omni.toml`.

## File Structure

```toml
# Global environment variables
[env]

# Provider configuration
[providers]

# Capabilities configuration
[capabilities]
[capabilities.sources]
[capabilities.groups]

# MCP server definitions
[mcps.<name>]

# Profile definitions
[profiles.<name>]
```

## Environment Variables

Global environment variables available to all capabilities and MCP servers.

### `[env]`

Define environment variables that can be referenced using `${VAR_NAME}` syntax.

```toml
[env]
DATABASE_URL = "${DATABASE_URL}"
API_KEY = "${MY_API_KEY}"
NODE_ENV = "production"
```

**Notes:**
- Use `${VAR_NAME}` to reference shell environment variables
- Variables defined here are available to all capabilities and MCP servers
- Useful for sharing configuration across multiple components

## Provider Configuration

### `[providers]`

Configure which providers OmniDev should sync with.

#### `enabled`

List of provider IDs to enable.

```toml
[providers]
enabled = ["claude", "cursor"]
```

**Available providers:**
- `claude` - Claude.ai (default)
- `claude-code` - Claude Code CLI
- `cursor` - Cursor Editor
- `codex` - Codex
- `opencode` - OpenCode

**Default:** `["claude"]` if not specified

## Capabilities Configuration

### `[capabilities]`

Root-level capabilities configuration.

#### `always_enabled`

Array of capability IDs that load in ALL profiles, regardless of profile configuration.

```toml
[capabilities]
always_enabled = ["git-tools", "linting"]
```

**Use cases:**
- Essential tools needed in every workflow
- Cross-cutting concerns (logging, error handling)
- Team-wide standards and practices

**Notes:**
- These capabilities load in addition to profile-specific ones
- Applies to all profiles automatically
- Cannot be disabled per-profile

### `[capabilities.sources]`

Define capability sources from Git repositories or local files.

#### Git Sources

**Shorthand syntax:**
```toml
[capabilities.sources]
obsidian = "github:kepano/obsidian-skills"
```

**Full syntax with options:**
```toml
[capabilities.sources]
tools = { source = "github:user/repo", ref = "v1.0.0" }
ralph = { source = "github:user/repo", path = "packages/capability" }
```

**Supported Git URLs:**
- GitHub shorthand: `github:user/repo`
- GitHub SSH: `git@github.com:user/repo.git`
- GitHub HTTPS: `https://github.com/user/repo.git`
- GitLab: `https://gitlab.com/user/repo.git`
- Any Git URL

**Options:**
- `source` (string, required): Git URL or shorthand
- `ref` (string, optional): Git ref to checkout (tag, branch, or commit hash)
- `path` (string, optional): Subdirectory containing the capability

#### Local Sources

Use `file://` prefix for local file system paths.

```toml
[capabilities.sources]
my-cap = "file://./capabilities/my-cap"
dev-tools = { source = "file://../shared/tools" }
```

**Notes:**
- Path can be relative to project root or absolute
- Useful for local development and testing
- Not locked in `omni.lock.toml`

### `[capabilities.groups]`

Bundle multiple capabilities under a single name for cleaner profile configurations.

```toml
[capabilities.groups]
expo = ["expo-app-design", "expo-deployment", "upgrading-expo"]
backend = ["cloudflare", "database-tools"]
frontend = ["react", "typescript", "ui-design"]
```

**Usage in profiles:**
```toml
[profiles.mobile]
capabilities = ["group:expo", "react-native-tools"]
```

**Notes:**
- Reference groups with `group:` prefix in profiles
- Capabilities are automatically deduplicated
- Groups can be nested (group referencing capabilities from other groups)

## MCP Server Configuration

### `[mcps.<name>]`

Define MCP (Model Context Protocol) servers that automatically become capabilities.

Reference in profiles using the MCP name directly (e.g., `capabilities = ["filesystem"]`).

#### Transport Types

##### stdio (default)

Local process using stdin/stdout.

```toml
[mcps.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
transport = "stdio"  # optional, default
```

**Required fields:**
- `command` (string): Executable to run

**Optional fields:**
- `args` (array of strings): Command arguments
- `env` (table): Environment variables
- `cwd` (string): Working directory

##### http

Remote HTTP server (recommended for remote servers).

```toml
[mcps.notion]
transport = "http"
url = "https://mcp.notion.com/mcp"
headers = { Authorization = "Bearer ${API_TOKEN}" }
```

**Required fields:**
- `url` (string): HTTP endpoint URL

**Optional fields:**
- `headers` (table): HTTP headers for authentication

##### sse

Server-Sent Events (deprecated, use http instead).

```toml
[mcps.legacy]
transport = "sse"
url = "https://example.com/sse"
```

**Required fields:**
- `url` (string): SSE endpoint URL

**Optional fields:**
- `headers` (table): HTTP headers for authentication

#### Environment Variables

Use `${VAR}` to reference environment variables:

```toml
[mcps.database]
command = "node"
args = ["./mcp-server.js"]
env = { DB_URL = "${DATABASE_URL}", API_KEY = "${API_KEY}" }
```

**Notes:**
- Variables can reference shell environment or `[env]` section
- Supports nested variable references
- Variables are expanded at runtime

#### Complete Example

```toml
[mcps.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
cwd = "/home/user/project"
env = { LOG_LEVEL = "debug" }

[mcps.database]
command = "node"
args = ["./servers/database.js"]
env = { DB_URL = "${DATABASE_URL}" }

[mcps.remote-api]
transport = "http"
url = "https://api.example.com/mcp"
headers = { Authorization = "Bearer ${API_TOKEN}" }
```

## Profile Configuration

### `[profiles.<name>]`

Define different capability sets for different workflows.

#### `capabilities`

Array of capability IDs or group references to enable in this profile.

```toml
[profiles.default]
capabilities = ["tasks", "git-tools"]

[profiles.planning]
capabilities = ["ralph", "tasks", "project-manager"]

[profiles.frontend]
capabilities = ["group:frontend", "design-system"]
```

**Capability references:**
- Direct capability ID: `"capability-id"`
- Group reference: `"group:group-name"`
- MCP server name: `"mcp-name"`

**Notes:**
- Capabilities are loaded in addition to `[capabilities.always_enabled]`
- Duplicates are automatically removed
- Groups are expanded to their constituent capabilities

#### Switching Profiles

```bash
omnidev profile use planning
```

See [Profiles documentation](./profiles) for more details.

## Complete Example

```toml
# =============================================================================
# Environment Variables
# =============================================================================
[env]
DATABASE_URL = "${DATABASE_URL}"
API_KEY = "${MY_API_KEY}"

# =============================================================================
# Provider Configuration
# =============================================================================
[providers]
enabled = ["claude", "cursor"]

# =============================================================================
# Capabilities Configuration
# =============================================================================
[capabilities]
always_enabled = ["git-tools", "linting"]

[capabilities.sources]
# GitHub sources
obsidian = "github:kepano/obsidian-skills"
ralph = { source = "github:user/ralph", ref = "v2.0.0" }
tools = { source = "github:org/monorepo", path = "packages/tools" }

# Local sources
my-cap = "file://./capabilities/my-cap"

[capabilities.groups]
expo = ["expo-app-design", "expo-deployment", "upgrading-expo"]
backend = ["cloudflare", "database-tools"]

# =============================================================================
# MCP Servers
# =============================================================================
[mcps.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]

[mcps.database]
command = "node"
args = ["./servers/database.js"]
env = { DB_URL = "${DATABASE_URL}" }

[mcps.remote-api]
transport = "http"
url = "https://api.example.com/mcp"
headers = { Authorization = "Bearer ${API_TOKEN}" }

# =============================================================================
# Profiles
# =============================================================================
[profiles.default]
capabilities = ["obsidian", "filesystem"]

[profiles.planning]
capabilities = ["ralph", "obsidian"]

[profiles.mobile]
capabilities = ["group:expo", "obsidian"]

[profiles.fullstack]
capabilities = ["group:expo", "group:backend", "database", "filesystem"]
```

## Related Configuration Files

- `omni.lock.toml` - Version lock file (see [Configuration](./config-files))
- `omni.local.toml` - Local overrides (same structure as `omni.toml`)
- `OMNI.md` - Project instructions (see [OMNI.md](./omni-md))

## See Also

- [Capability Sources](./capabilities) - Working with capability sources
- [Profiles](./profiles) - Managing profiles
- [MCP Servers](../capabilities/mcp-servers) - MCP server details
- [Configuration Files](./config-files) - Configuration file overview
