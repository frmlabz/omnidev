# OmniDev Config Examples

This directory contains example `omni.toml` configurations demonstrating different ways to load and organize capabilities.

> **CI Tested**: All examples pull from real GitHub sources (`github:frmlabz/omnidev`) and are validated by `examples.test.ts` on every push/PR.

## Example Files

| File | Description |
|------|-------------|
| `basic.toml` | Minimal setup with a single capability |
| `profiles.toml` | Multiple profiles for different workflows |
| `github-sources.toml` | Loading capabilities from GitHub with version pinning |
| `local-dev.toml` | Loading from local directories for development |
| `comprehensive.toml` | Mixed sources with advanced profile setup |
| `mcp.toml` | MCP server configuration |

## Fixtures

The `fixtures/` directory contains real capabilities used for testing. These are pulled from GitHub by the example configs.

| Fixture | Type | Description |
|---------|------|-------------|
| `standard/` | Full capability | Complete capability with `capability.toml`, skills, and rules |
| `claude-plugin/` | Auto-wrapped | `.claude-plugin/plugin.json` format (auto-generates capability.toml) |
| `bare-skills/` | Auto-wrapped | Just a `skills/` directory (auto-generates capability.toml) |
| `demo-mcp/` | MCP Server | TypeScript MCP server using `@modelcontextprotocol/sdk` |

### Fixture Markers

Each fixture contains unique markers to verify content was synced correctly:

- `FIXTURE_MARKER:STANDARD_SKILL` - Standard fixture skill
- `FIXTURE_MARKER:STANDARD_RULE` - Standard fixture rule
- `FIXTURE_MARKER:CLAUDE_PLUGIN_SKILL` - Claude plugin fixture skill
- `FIXTURE_MARKER:BARE_SKILL` - Bare skills fixture skill
- `FIXTURE_MARKER:DEMO_MCP_RESPONSE` - Demo MCP server response

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

- **GitHub**: `github:owner/repo` or `{ source = "github:owner/repo", version = "v1.0.0" }`
- **File paths**: `file:///absolute/path` or `file://./relative/path`

### Loading from Monorepos

Load specific subdirectories using the `path` parameter:

```toml
[capabilities.sources]
# Load from a subdirectory in a monorepo
my-skill = { source = "github:owner/repo", path = "plugins/my-skill" }
```

### Auto-Wrapping

OmniDev automatically generates `capability.toml` when:
- `.claude-plugin/plugin.json` exists in the directory, OR
- Expected directories exist (`skills/`, `agents/`, `commands/`, `rules/`, `docs/`)

### Profiles

Profiles group capabilities for different workflows:

```toml
[profiles.default]
capabilities = ["standard"]

[profiles.extended]
capabilities = ["standard", "claude-plugin", "bare-skills"]
```

Switch profiles: `omnidev profile set extended`

### Version Pinning

For production, always pin versions:

```toml
[capabilities.sources]
# Recommended: Pin to a version tag
my-cap = { source = "github:owner/repo", version = "v1.0.0" }

# Most precise: Pin to a commit hash
my-cap = { source = "github:owner/repo", version = "abc123def456" }
```

### MCP Servers

Define MCP servers directly in `omni.toml`:

```toml
[mcps.my-server]
command = "bun"
args = ["run", ".omni/capabilities/my-mcp/src/index.ts"]
transport = "stdio"
```

### Local Overrides

Use `omni.local.toml` (gitignored) for personal customizations:

```toml
# omni.local.toml - override sources for local development
[capabilities.sources]
standard = "file://./local/standard-dev"
```

## Testing

Run the integration tests:

```bash
bun test ./examples
```

Tests verify that:
1. Each example config syncs successfully from GitHub
2. Expected capabilities are present
3. Fixture markers appear in synced content

## Best Practices

1. **Pin versions** for production (`version = "v1.0.0"`)
2. **Use profiles** to separate workflows
3. **Commit `omni.toml`** to share with your team
4. **Gitignore `omni.local.toml`** for personal overrides
5. **Test capabilities locally** with `file://` before publishing
