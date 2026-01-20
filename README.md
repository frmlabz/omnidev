# OmniDev, the missing package manager for AI coding capabilities

A universal package manager to discover, install, and manage capabilities for AI coding agents across all providers.

**OmniDev creates capabilities, which can contain subagents, commands, hooks, skills, and rules, adapts them to work with every AI coding tool.** Define once, use everywhere.

Yes, we know. Another standard ([obligatory xkcd](https://xkcd.com/927/)). But hear me out.

---

> ⚠️ **Alpha Notice:**  
> OmniDev is **alpha software**—breaking changes may occur as we continue rapid development and iterate on features!

---

## The Problem

[![config sprawl](./docs/img/config-sprawl.png)](./docs/img/config-sprawl.png)

Every AI coding tool reinvents the wheel—different folder structures (`.cursor/`, `.claude/`, `.agent/`), different config formats, and they can't even agree on whether it's "skill" or "skills". This makes it painful to share setups with your team or switch between tools.

But it's not just about config locations. **It's also about context.** AI agents work better with focused, task-specific context. You don't want to load database tools when working on UI, or vice versa. But switching between different configurations of hooks, agents, skills and commands depending on your task is very verbose and requires a ton of manual work or bash scripts.

## The Solution

OmniDev is to AI capabilities what npm is to JavaScript packages. Write your configuration once, use it everywhere:

- **One config, all tools** — Works with Cursor, Claude Code, Codex, OpenCode, Amp, and more
- **Git-based capabilities** — Install from GitHub, version lock, and share with your team
- **Profile switching** — Load different capability sets for frontend, backend, planning, etc.
- **Extensible** — Capabilities can add custom CLI commands and extend functionality

**Why OmniDev vs `npx skills`?** OmniDev manages more than just skills—it handles **subagents**, **commands**, **rules**, **MCP servers**, and can even load **Claude plugins** in a single system.

## Quick Start

```bash
# Install
npm install -g @omnidev-ai/cli

# Initialize in your project
omnidev init

# Add a capability from GitHub
omnidev add cap my-tools --github user/repo

# Check everything is working
omnidev doctor
```

This creates an `omni.toml` configuration file and `.omni/` directory with your capabilities.

**📚 [Read the full getting started guide →](https://omnidev.nikolamilovic2001.workers.dev/getting-started/)**

## What Can OmniDev Do?

### Manage Capabilities
Install reusable AI capabilities from GitHub or local directories:
```bash
omnidev add cap obsidian --github kepano/obsidian-skills
omnidev add cap my-local --local ./capabilities/custom
```

### Switch Profiles
Use different capability sets for different contexts:
```bash
omnidev profile set frontend   # Load UI/accessibility tools
omnidev profile set backend    # Load database/API tools
```

### Add MCP Servers
Integrate Model Context Protocol servers:
```bash
omnidev add mcp filesystem --command npx --args "-y @modelcontextprotocol/server-filesystem /path"
```
MCP-only environment variables can be set in `omni.toml` with `env = { KEY = "value" }` under `[mcps.<name>]` or via `omnidev add mcp --env KEY=value`.
### Write Once, Use Everywhere
Define your project instructions in `OMNI.md` and OmniDev generates provider-specific files (`CLAUDE.md`, `AGENTS.md`, etc.) automatically.

## Documentation

- **[Getting Started](https://omnidev.nikolamilovic2001.workers.dev/getting-started/)** — Installation and first steps
- **[Configuration](https://omnidev.nikolamilovic2001.workers.dev/configuration/overview/)** — Configure capabilities, profiles, and providers
- **[Capabilities](https://omnidev.nikolamilovic2001.workers.dev/capabilities/overview/)** — Create and share capabilities
- **[Commands](https://omnidev.nikolamilovic2001.workers.dev/commands/core/)** — CLI reference
- **[Examples](examples/)** — Sample configurations for different setups

## Examples

Check out the [examples/](examples/) directory for sample configurations:
- [basic.toml](examples/basic.toml) — Simple single-capability setup
- [profiles.toml](examples/profiles.toml) — Multiple profiles for different contexts
- [mcp.toml](examples/mcp.toml) — MCP server integration

Explore community capabilities at [omnidev-capabilities](https://github.com/Nikola-Milovic/omnidev-capabilities).


## 🤝 Contributing

We wholeheartedly welcome contributions!  
With so many providers and configuration permutations, we rely on your feedback and help to ensure everything runs smoothly.

- **Found a bug or issue?**  
  [Open an issue](https://github.com/Nikola-Milovic/omnidev/issues) to let us know!

- **Want to submit a pull request?**  
  Awesome! Feel free to submit fixes and improvements.

- **Thinking of adding a new feature?**  
  **Let's discuss it first!**  
  Open an issue to propose your idea so we can chat and plan the best approach.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and architecture.

## License

MIT
