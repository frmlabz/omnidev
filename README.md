# OmniDev

NPM for AI agentic coding capabilities. A universal way to discover, install, and manage command subagents, skills, and custom functionality for AI coding agents across all providers.

Yes, we know. Another standard ([obligatory xkcd](https://xkcd.com/927/)). But hear us out.

## The Problem

[![config sprawl](./docs/img/config-sprawl.png)](./docs/img/config-sprawl.png)

We've reached a point of absolute configuration chaos. Every AI provider has decided to reinvent the wheel—different folder structures (`.cursor/`, `.claude/`, `.agent/`), different configuration formats, and they can't even agree on plurality, skill vs skills, agent vs agents, etc.

This lack of standardization makes working in this ecosystem painful. You can't share setups with your team, you can't switch agents without rewriting everything or symlinking this to that.

### Why not just use `npx skills`?

The Vercel [`skills`](https://www.npmjs.com/package/skills) package is a cool idea, but it doesn't fully deliver. It lacks critical features (`find` and `update` commands are currently planned) and limits itself to just managing "skills".

**OmniDev is the missing piece**

It manages **hooks**, **commands**, **sub-agents**, **skills**, **rules**, and can even load **Claude plugins** in a single, clean system. It allows you to:
- **Extend the CLI** to support tools like Ralph without external scripts.
- **Import capabilities** from any GitHub repo or local folder.
- **Make your setup portable** across any tool (OpenCode, Cursor, Claude, Codex, Amp,etc.).
- **Manage everything via Git** with version locking.

## The Solution

OmniDev is to agentic capabilities what npm is to JavaScript packages: a package manager that lets you discover, install, version, and share AI agent functionality.

Capabilities can easily be hosted on Git and OmniDev provides the missing piece: download them, lock their versions, and adapt them to work with any AI provider you use.

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

Define your capabilities once, use them anywhere—OpenCode, Cursor, Claude, Codex, Amp, etc. OmniDev provides the runtime layer that makes your agentic code provider-agnostic.

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
├── OMNI.md             # Your project instructions (single source of truth)
├── omni.toml           # Configuration (commit this)
├── omni.lock.toml      # Version lock (commit this)
├── CLAUDE.md           # Generated from OMNI.md (for Claude Code)
├── AGENTS.md           # Generated from OMNI.md (for Codex)
└── .omni/              # Runtime files (gitignored)
    └── instructions.md # Auto-generated capability content
```

## Project Instructions (OMNI.md)

`OMNI.md` is your single source of truth for project instructions. Instead of maintaining separate `CLAUDE.md`, `AGENTS.md`, etc. for each provider, you write your instructions once in `OMNI.md` and OmniDev generates the provider-specific files during sync.

```markdown
# My Project

## Project Description
A web application for managing tasks...

## Conventions
- Use TypeScript strict mode
- Follow the existing code style
...
```

When you run `omnidev sync`, OmniDev:
1. Reads your `OMNI.md` content
2. Generates `CLAUDE.md`, `AGENTS.md`, etc. with your content + `@import .omni/instructions.md`
3. The `.omni/instructions.md` contains auto-generated content from your enabled capabilities

This means you can:
- **Write once, use everywhere** — Same instructions across all AI providers
- **Keep capability content separate** — Your instructions stay clean, capability rules/docs are auto-imported
- **Optionally gitignore generated files** — During `omnidev init`, you can choose to gitignore provider files since they're regenerated from `OMNI.md`

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
| `omnidev add cap` | Add a capability from GitHub |
| `omnidev add mcp` | Add an MCP server |
| `omnidev profile list` | Show profiles |
| `omnidev profile set <name>` | Switch profile |
| `omnidev capability list` | List capabilities |
| `omnidev provider list` | Show available providers |
| `omnidev provider enable <id>` | Enable a provider |
| `omnidev provider disable <id>` | Disable a provider |

### Adding Capabilities and MCP Servers

The `omnidev add` command provides a quick way to add capabilities and MCP servers:

```bash
# Add a capability from GitHub
omnidev add cap my-cap --github user/repo
omnidev add cap my-cap --github user/repo --path plugins/subdir

# Add an MCP server (stdio - local process)
omnidev add mcp filesystem --command npx --args "-y @modelcontextprotocol/server-filesystem /path"
omnidev add mcp database --command node --args "./servers/db.js" --env DB_URL=postgres://localhost

# Add an MCP server (http - remote)
omnidev add mcp notion --transport http --url https://mcp.notion.com/mcp
omnidev add mcp secure-api --transport http --url https://api.example.com/mcp --header "Authorization: Bearer token"
```

Both commands automatically:
- Add the source/server to `omni.toml`
- Enable it in the active profile
- Run `omnidev sync` to apply changes

Capabilities can extend the CLI with custom commands—for example, `omnidev ralph status` for workflow visualization.

## Providers

OmniDev supports multiple AI coding tools through **provider adapters**:

| Provider | ID | Skills Directory | Description |
|----------|-----|-----------------|-------------|
| Claude Code | `claude-code` | `.claude/skills/` | Claude CLI (default) |
| Cursor | `cursor` | `.cursor/skills/` | Cursor IDE |
| Codex | `codex` | `.codex/skills/` | GitHub Codex |
| OpenCode | `opencode` | `.opencode/skills/` | Open-source alternative |
| Amp | `amp` | `.agents/skills/` | Sourcegraph Amp |
| OmniDev | `omnidev` | `.agent/skills/` | OmniDev itself |

Enable providers during init or anytime:

```bash
# During initialization
omnidev init claude-code,cursor

# Or enable later
omnidev provider enable cursor
```

### Terminology Note

**Important:** Each AI coding tool uses different terminology for similar concepts:

| Concept | Claude Code | Cursor | Codex | OpenCode | Amp | OmniDev |
|---------|-------------|--------|-------|----------|-----|----------|
| **Subagents** | Subagents | Agents | N/A (SDK only) | Subagents | Subagents | Agents |
| **Skills** | Skills | Skills | N/A | Skills | Skills | Skills |
| **Rules/Guidelines** | Settings | .cursorrules | Config | Rules | Commands | Rules |
| **Custom Commands** | N/A | Slash commands | CLI commands | Commands | Commands | Commands |

This fragmentation makes it difficult to share configurations between tools. OmniDev abstracts these differences so you write once, use everywhere.

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
| `OMNI.md` | Project instructions (source of truth) | Commit |
| `omni.toml` | Main configuration | Commit |
| `omni.local.toml` | Local overrides | Ignore |
| `omni.lock.toml` | Version lock | Commit |
| `.omni/` | Runtime directory | Ignore |
| `CLAUDE.md` | Generated for Claude Code | Optional |
| `AGENTS.md` | Generated for Codex | Optional |

**Note:** Provider-specific files (`CLAUDE.md`, `AGENTS.md`, etc.) are generated from `OMNI.md` during sync. You can choose to commit them or gitignore them during `omnidev init`.

## Roadmap

- [ ] Support `.env` files for MCP environment variables (qualify of life feature)
- [ ] Hooks
- [ ] Commands
- [ ] Better versioning support
- [ ] Programmatic skills with bash content should run chmod +x on them.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and architecture.

## License

MIT
