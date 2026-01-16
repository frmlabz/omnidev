# Contributing to OmniDev

Thanks for your interest in contributing! This guide covers development setup, architecture, and how to contribute.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/omnidev.git
cd omnidev

# Install dependencies
bun install

# Run checks (typecheck + lint + format + test)
bun run check

# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

## Project Structure

```
omnidev/
├── packages/
│   ├── core/           # Shared types, config loader, capability system
│   ├── cli/            # Command-line interface (Stricli)
│   └── mcp/            # MCP server (sandbox tools)
├── capabilities/       # Built-in capabilities
│   ├── ralph/          # AI orchestrator for PRD-driven development
│   ├── tasks/          # Task management
│   └── context7/       # Documentation fetching
└── docs/               # Documentation
```

### Package Overview

**`@omnidev/core`**
- Configuration loading and parsing (`omni.toml`, `omni.local.toml`)
- Capability registry and loader
- Capability sources (Git and file protocols)
- Lock file management
- Type definitions

**`@omnidev/cli`**
- Commands: `init`, `sync`, `doctor`, `profile`, `capability`, `serve`
- Built with [Stricli](https://bloomberg.github.io/stricli/)

**`@omnidev/mcp`**
- MCP server implementation
- Sandbox environment for code execution
- Tool discovery and execution

## Architecture

### Configuration Flow

```
omni.toml (user config)
    ↓
omni.local.toml (local overrides, merged)
    ↓
loadConfig() → OmniConfig
    ↓
buildCapabilityRegistry() → discovers and loads capabilities
    ↓
syncAgentConfiguration() → generates output files
```

### Capability Sources

Capabilities can come from three places:

1. **Built-in** (`capabilities/` in this repo)
2. **Git sources** — Cloned to `.omni/capabilities/`, tracked by commit hash
3. **File sources** — Copied to `.omni/capabilities/`, tracked by content hash

The lock file (`omni.lock.toml`) ensures reproducible builds:

```toml
[capabilities.my-cap]
source = "github:user/repo"
version = "1.0.0"
commit = "abc123def..."
updated_at = "2026-01-16T..."

[capabilities.local-cap]
source = "file://./path"
version = "a1b2c3d4e5f6"
content_hash = "sha256:..."
updated_at = "2026-01-16T..."
```

### File Conventions

| File | Location | Committed |
|------|----------|-----------|
| Main config | `omni.toml` | Yes |
| Local overrides | `omni.local.toml` | No |
| Lock file | `omni.lock.toml` | Yes |
| Runtime directory | `.omni/` | No |
| Installed capabilities | `.omni/capabilities/` | No |
| State files | `.omni/state/` | No |

## Key Files

### Core Package

| File | Purpose |
|------|---------|
| `packages/core/src/config/loader.ts` | Config loading and merging |
| `packages/core/src/capability/sources.ts` | Git and file source fetching |
| `packages/core/src/capability/registry.ts` | Capability discovery and loading |
| `packages/core/src/capability/loader.ts` | Individual capability loading |
| `packages/core/src/sync.ts` | Orchestrates sync process |
| `packages/core/src/types/index.ts` | Type definitions |

### CLI Package

| File | Purpose |
|------|---------|
| `packages/cli/src/commands/init.ts` | Project initialization |
| `packages/cli/src/commands/sync.ts` | Sync command |
| `packages/cli/src/commands/profile.ts` | Profile management |
| `packages/cli/src/commands/doctor.ts` | Setup verification |

### MCP Package

| File | Purpose |
|------|---------|
| `packages/mcp/src/server.ts` | MCP server entry |
| `packages/mcp/src/tools/execute.ts` | Sandbox execution |
| `packages/mcp/src/sandbox.ts` | Sandbox environment |

## Testing

Tests are co-located with source files (`*.test.ts`).

```bash
# Run all tests
bun test

# Run specific test file
bun test packages/core/src/config/loader.test.ts

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch
```

### Test Patterns

- Tests create temporary directories and clean up after
- Mock `process.exit` for CLI tests
- Use `beforeEach`/`afterEach` for setup/teardown

## Code Quality

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check everything
bun run check

# Just lint
bun run lint

# Just format
bun run format

# Fix issues
bun run lint:fix
bun run format:fix
```

Git hooks (via [Lefthook](https://github.com/evilmartians/lefthook)) run checks on commit.

## Making Changes

1. **Create a branch** from `main`
2. **Make your changes** with tests
3. **Run checks**: `bun run check`
4. **Commit** with a descriptive message
5. **Open a PR** against `main`

### Commit Messages

Use clear, descriptive commit messages:

```
add file:// protocol support for capability sources

- Add FileCapabilitySourceConfig type
- Implement parseFilePath() for file:// URLs
- Add content hash tracking for change detection
- Update lock file format for file sources
```

## Roadmap

### Completed
- Bun monorepo setup
- Code quality infrastructure (Biome, Lefthook)
- Testing infrastructure
- Core types and configuration
- Capability system (loader, skills, rules, docs)
- CLI package (Stricli)
- MCP server package
- Ralph capability (AI orchestrator)
- MCP server wrapping
- Capability sources (Git and file protocols)

### Planned
- TUI views (OpenTUI)
- Capability hub / remote installation
- Git safety layer (checkpoints, rollback)
- Doc indexing and search

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh) |
| CLI Framework | [Stricli](https://bloomberg.github.io/stricli/) |
| MCP Server | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) |
| Configuration | TOML ([smol-toml](https://github.com/nicolo-ribaudo/smol-toml)) |
| Linting | [Biome](https://biomejs.dev/) |
| Git Hooks | [Lefthook](https://github.com/evilmartians/lefthook) |

## Questions?

Open an issue for questions or discussion.
