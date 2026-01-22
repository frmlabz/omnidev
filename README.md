# OmniDev, the missing package manager for AI coding capabilities

Turn any GitHub repo with skills, rules, or prompts into a portable capability.

**Point to any directory. Wrap it. Use it.** OmniDev takes existing content—GitHub repos, local folders—and wraps them into capabilities that you can version, share, and manage across your AI coding tools.

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

OmniDev is a package manager for AI capabilities, similar to how npm works for JavaScript packages:

- **Wrap anything** — Point to any GitHub repo or local folder containing skills/rules/prompts and OmniDev wraps it into a capability
- **One config, all tools** — Works with Claude Code, Cursor, Codex, OpenCode, Amp, and more
- **Profile switching** — Load different capability sets for frontend, backend, planning, etc.
- **Full-featured** — Capabilities can contain skills, rules, commands, subagents, hooks, and MCP servers

**Why OmniDev?** Stop copying files between projects. Point to a repo, wrap it as a capability, version it, and share it with your team.

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
- **[Configuration](https://omnidev.nikolamilovic2001.workers.dev/configuration/config-files/)** — Configure capabilities, profiles, and providers
- **[Capabilities](https://omnidev.nikolamilovic2001.workers.dev/capabilities/overview/)** — Create and share capabilities
- **[Commands](https://omnidev.nikolamilovic2001.workers.dev/commands/init/)** — CLI reference
- **[Examples](examples/)** — Sample configurations for different setups

## Examples

Check out the [examples/](examples/) directory for sample configurations:
- [basic.toml](examples/basic.toml) — Simple single-capability setup
- [profiles.toml](examples/profiles.toml) — Multiple profiles for different contexts
- [mcp.toml](examples/mcp.toml) — MCP server integration

Explore community capabilities at [omnidev-capabilities](https://github.com/frmlabz/omnidev-capabilities).


## 🤝 Contributing

We wholeheartedly welcome contributions!  
With so many providers and configuration permutations, we rely on your feedback and help to ensure everything runs smoothly.

- **Found a bug or issue?**  
  [Open an issue](https://github.com/frmlabz/omnidev/issues) to let us know!

- **Want to submit a pull request?**  
  Awesome! Feel free to submit fixes and improvements.

- **Thinking of adding a new feature?**  
  **Let's discuss it first!**  
  Open an issue to propose your idea so we can chat and plan the best approach.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and architecture.

## License

MIT
