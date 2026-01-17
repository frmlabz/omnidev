# OmniDev Configuration Examples

This directory contains example `omni.toml` configurations demonstrating different ways to load and organize capabilities.

## Files

| File | Description |
|------|-------------|
| `basic.toml` | Minimal setup with a single capability |
| `profiles.toml` | Multiple profiles for different workflows |
| `github-sources.toml` | Loading capabilities from GitHub with version pinning |
| `mcp-wrapping.toml` | Wrapping MCP servers from Git repositories |
| `local-dev.toml` | Loading from local directories for development |
| `comprehensive.toml` | Mixed sources with advanced profile setup |

## Quick Start

Copy an example to your project root:

```bash
cp examples/basic.toml omni.toml
```

Then initialize and sync:

```bash
omnidev init
omnidev sync
```

## Configuration Concepts

### Sources

Capabilities can come from:

- **GitHub**: `github:owner/repo` or `github:owner/repo@ref`
- **File paths**: `file:///absolute/path` or `file://./relative/path`

### Profiles

Profiles group capabilities for different workflows:

```toml
[profiles.default]
capabilities = ["tasks"]

[profiles.planning]
capabilities = ["tasks", "ralph"]
```

Switch profiles: `omnidev profile set planning`

### Version Pinning

For production, always pin versions:

```toml
# Recommended
tasks = { source = "github:owner/repo", ref = "v1.0.0" }

# Most precise (commit hash)
tasks = { source = "github:owner/repo", ref = "abc123" }
```

### Loading from Monorepos

Load individual capabilities from repositories with multiple plugins using the `path` parameter:

```toml
# Load specific subdirectories from a monorepo
expo-app-design = { source = "github:expo/skills", path = "plugins/expo-app-design" }
expo-deployment = { source = "github:expo/skills", path = "plugins/expo-deployment" }
```

Wrapping is auto-detected when:
- `.claude-plugin/plugin.json` exists in the directory, OR
- Expected directories exist (skills/, agents/, commands/, rules/, docs/)

When wrapping, OmniDev will:
- Auto-discover skills, agents, commands, rules, and docs
- Extract metadata from `.claude-plugin/plugin.json` if present
- Use README.md content as description
- Generate a `capability.toml` automatically

### Wrapping MCP Servers

MCP (Model Context Protocol) servers can be loaded from Git repositories and automatically wrapped as capabilities:

```toml
# From the official MCP servers monorepo
filesystem-mcp = { source = "github:modelcontextprotocol/servers", path = "src/filesystem" }
github-mcp = { source = "github:modelcontextprotocol/servers", path = "src/github" }

# Community MCP servers
playwright-mcp = { source = "github:executeautomation/mcp-playwright" }

# Custom MCP from your organization
internal-mcp = { source = "github:your-org/internal-mcp-server", ref = "v1.2.0" }
```

MCP servers are auto-detected by:
- Presence of MCP server configuration files
- `package.json` with MCP-related dependencies
- Standard MCP directory structure

Once wrapped, the MCP server becomes available as a capability and its tools are exposed through OmniDev's MCP controller.

### Local Overrides

Use `omni.local.toml` (gitignored) for personal customizations:

```toml
# omni.local.toml
[profiles.default]
capabilities = ["tasks", "my-experimental-tool"]
```

## Best Practices

1. **Pin versions** for production (`ref = "v1.0.0"`)
2. **Use profiles** to separate workflows (frontend vs backend)
3. **Commit `omni.toml`** to share with your team
4. **Gitignore `omni.local.toml`** for personal overrides
5. **Test capabilities locally** with `file://` before publishing to GitHub
