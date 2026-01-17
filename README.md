# OmniDev

NPM for AI agentic coding capabilities. A universal way to discover, install, and manage command subagents, skills, and custom functionality for AI coding agents across all providers.

[![xkcd: Standards](https://imgs.xkcd.com/comics/standards.png)](https://xkcd.com/927/)

Yes, we know. Another standard. But hear us out.

## The Problem

AI coding assistants are fragmenting into incompatible ecosystems:
- `.cursor/` for Cursor
- `.claude/` for Claude Code
- `.agent/` for other agents
- Provider-specific tool servers that don't talk to each other

This makes it hard to:
- **Share setups with your team** — Everyone uses different tools
- **Switch between agents** — Reconfigure everything each time
- **Customize without forking** — Override team defaults for your workflow

## The Solution

OmniDev is to agentic capabilities what npm is to JavaScript packages: a package manager that lets you discover, install, version, and share AI agent functionality.

Capabilities are already hosted on Git, but OmniDev provides the missing piece: download them, lock their versions, and adapt them to work with any AI provider you use.

It adds `omni.toml` and `omni.lock.toml` to your project. Yes, more config files. But the tradeoff is worth it:

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

**3. Works across all AI providers**

Define your capabilities once, use them anywhere—Cursor, Claude, GitHub Copilot, custom agents, and more. OmniDev provides the runtime layer that makes your agentic code provider-agnostic.

**4. Extensible CLI and runtime**

Capabilities can extend the OmniDev CLI itself—add custom commands, views, and tooling directly into `omnidev`. For example, a planning capability might add an `omnidev ralph status` command to visualize agent workflows.

## Quick Start

```bash
# Install
npm install -g @omnidev-ai/cli

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

**What can capabilities do?**

Capabilities can:
- Add subagents and custom commands to the CLI
- Define skills for agent behaviors and workflows
- Add rules and guidelines for AI agents
- Manage custom documentation

**See examples:**
- [examples/](examples/) — Configuration examples for different setups (basic, profiles, monorepos, etc.)
- [omnidev-capabilities](https://github.com/Nikola-Milovic/omnidev-capabilities) — Capability examples (playthings to showcase capabilities—community library will grow over time)

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

Core commands (always available):

| Command | Description |
|---------|-------------|
| `omnidev init` | Initialize OmniDev |
| `omnidev sync` | Fetch sources and regenerate config |
| `omnidev doctor` | Check setup |
| `omnidev profile list` | Show profiles |
| `omnidev profile set <name>` | Switch profile |
| `omnidev capability list` | List capabilities |
| `omnidev provider list` | Show available providers |
| `omnidev provider enable <id>` | Enable a provider |
| `omnidev provider disable <id>` | Disable a provider |

Capabilities can extend the CLI with custom commands—for example, `omnidev ralph status` for workflow visualization.

## Providers

OmniDev supports multiple AI coding tools through **provider adapters**:

| Provider | ID | Description |
|----------|-----|-------------|
| Claude Code | `claude-code` | Claude CLI (default) |
| Cursor | `cursor` | Cursor IDE |
| Codex | `codex` | GitHub Codex |
| OpenCode | `opencode` | Open-source alternative |

Enable providers during init or anytime:

```bash
# During initialization
omnidev init claude-code,cursor

# Or enable later
omnidev provider enable cursor
```

See [docs/provider-adapters.md](docs/provider-adapters.md) for full documentation.

## Creating Capabilities

A capability is a directory with skills, rules, tools, and optional CLI commands:

```
my-capability/
├── capability.toml     # Metadata
├── skills/             # Agent behaviors
├── rules/              # Guidelines
├── cli.ts              # CLI command exports (optional)
└── index.ts            # Programmatic exports (optional)
```

See [docs/capability-development.md](docs/capability-development.md) for the full guide.

## File Structure

| File | Purpose | Git |
|------|---------|-----|
| `omni.toml` | Main configuration | Commit |
| `omni.local.toml` | Local overrides | Ignore |
| `omni.lock.toml` | Version lock | Commit |
| `.omni/` | Runtime directory | Ignore |

## Roadmap

- [ ] Support `.env` files for MCP environment variables (qualify of life feature)
- [ ] Different MCP protocols
- [ ] Command to easily add capabilities/ mcps to config (capability install/ add) (enable/ disable currently breaks omni.toml)
- [ ] Remove bun dependency (compile to JS and expose that instead of TS files)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and architecture.

## License

MIT
