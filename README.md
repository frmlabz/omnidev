# OmniDev

A capability system for AI coding agents. Load skills, rules, and tools on-demand through profiles.

[![xkcd: Standards](https://imgs.xkcd.com/comics/standards.png)](https://xkcd.com/927/)

Yes, we know. Another standard. But hear us out.

## The Problem

AI coding assistants are fragmenting into incompatible ecosystems:
- `.cursor/` for Cursor
- `.claude/` for Claude Code
- `.agent/` for other agents
- Various MCP servers that don't talk to each other

This makes it hard to:
- **Share setups with your team** — Everyone uses different tools
- **Switch between agents** — Reconfigure everything each time
- **Customize without forking** — Override team defaults for your workflow

## The Solution

OmniDev adds `omni.toml` and `omni.lock.toml` to your project. Yes, more config files. But the tradeoff is worth it:

**1. Reduced context = better AI decisions**

AI agents work better with focused context. Instead of loading every possible tool, load only what you need:
```toml
[profiles.frontend]
capabilities = ["ui-design", "accessibility"]

[profiles.backend]
capabilities = ["database", "api-design"]
```

**2. Shareable and extensible**

Commit `omni.toml` to share your setup. Team members can override with `omni.local.toml`:
```toml
# omni.local.toml (gitignored)
[profiles.default]
capabilities = ["my-custom-workflow"]
```

**3. One system, multiple outputs**

OmniDev generates configuration for whatever agent you use. Your capabilities work everywhere.

## Quick Start

```bash
# Install
npm install -g @omnidev/cli

# Initialize in your project
omnidev init

# Check setup
omnidev doctor
```

This creates:
```
your-project/
├── omni.toml           # Configuration (commit this)
├── omni.lock.toml      # Version lock (commit this)
└── .omni/              # Runtime files (gitignored)
```

## Configuration

### Adding Capabilities

Install capabilities from Git or local directories:

```toml
# omni.toml
[capabilities.sources]
# From GitHub
obsidian = "github:kepano/obsidian-skills"

# Pinned version
tools = { source = "github:user/repo", ref = "v1.0.0" }

# Local directory (for development)
my-cap = "file://./capabilities/custom"
```

Then sync:
```bash
omnidev sync
```

### Profiles

Switch between capability sets:

```toml
# omni.toml
[profiles.default]
capabilities = ["tasks"]

[profiles.planning]
capabilities = ["ralph", "tasks"]

[profiles.frontend]
capabilities = ["tasks", "ui-design"]
```

```bash
omnidev profile set planning
```

### Local Overrides

Customize without affecting the team:

```toml
# omni.local.toml (gitignored)
[profiles.default]
capabilities = ["my-experimental-tool"]
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `omnidev init` | Initialize OmniDev |
| `omnidev sync` | Fetch sources and regenerate config |
| `omnidev doctor` | Check setup |
| `omnidev profile list` | Show profiles |
| `omnidev profile set <name>` | Switch profile |
| `omnidev capability list` | List capabilities |
| `omnidev serve` | Start MCP server |

## MCP Server

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "omnidev": {
      "command": "npx",
      "args": ["-y", "@omnidev/cli", "serve"]
    }
  }
}
```

The server exposes:
- **`omni_sandbox_environment`** — Discover available capabilities
- **`omni_execute`** — Run TypeScript in a sandboxed environment

## Creating Capabilities

A capability is a directory with skills, rules, and tools:

```
my-capability/
├── capability.toml     # Metadata
├── skills/             # Agent behaviors
├── rules/              # Guidelines
└── index.ts            # Sandbox exports
```

See [docs/capability-development.md](docs/capability-development.md) for the full guide.

## File Structure

| File | Purpose | Git |
|------|---------|-----|
| `omni.toml` | Main configuration | Commit |
| `omni.local.toml` | Local overrides | Ignore |
| `omni.lock.toml` | Version lock | Commit |
| `.omni/` | Runtime directory | Ignore |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and architecture.

## License

MIT
