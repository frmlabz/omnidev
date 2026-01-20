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
│   └── adapters/       # Provider adapters (Claude, Cursor, Codex, etc.)
├── capabilities/       # Built-in capabilities
│   ├── ralph/          # AI orchestrator for PRD-driven development
│   ├── tasks/          # Task management
│   └── context7/       # Documentation fetching
└── docs/               # Documentation
```

### Package Overview

**`@omnidev-ai/core`**
- Configuration loading and parsing (`omni.toml`, `omni.local.toml`)
- Capability registry and loader
- Capability sources (Git and file protocols)
- Lock file management
- Provider state management
- Type definitions (including adapter interfaces)

**`@omnidev-ai/adapters`**
- Provider adapters: `claude-code`, `cursor`, `codex`, `opencode`
- Adapter registry for discovery
- Provider-specific file writing

**`@omnidev-ai/cli`**
- Commands: `init`, `sync`, `doctor`, `profile`, `capability`, `provider`
- Built with [Stricli](https://bloomberg.github.io/stricli/)

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
buildSyncBundle() → provider-agnostic bundle
    ↓
syncAgentConfiguration() → generates .omni/ files
    ↓
adapters.sync() → provider-specific files
```

### Provider Adapter Layer

OmniDev uses a **Provider Adapter** architecture to decouple core functionality from provider-specific file formats:

```
┌─────────────────────────────────────────────────────────────┐
│                          Core                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Capability │───▶│ SyncBundle  │───▶│  Adapters   │      │
│  │   Registry  │    │  (agnostic) │    │             │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ Claude Code │  │   Cursor    │  │    Codex    │
     │   Adapter   │  │   Adapter   │  │   Adapter   │
     └─────────────┘  └─────────────┘  └─────────────┘
```

**Key concepts:**
- **SyncBundle**: Provider-agnostic data structure with all capabilities, skills, rules, etc.
- **Adapters**: Transform SyncBundle into provider-specific files
- **Provider State**: Stored in `.omni/state/providers.json` (gitignored, user-specific)

See [docs/provider-adapters.md](docs/provider-adapters.md) for full documentation.

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

### Package Exports

Packages use **conditional exports** to serve TypeScript to Bun and JavaScript to Node.js:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "bun": "./src/index.ts",
    "default": "./dist/index.js"
  }
}
```

- **`bun`** — Bun loads TypeScript directly (no build needed for dev/tests)
- **`default`** — Node.js gets built JavaScript from `dist/`
- **`types`** — TypeScript gets declaration files

This allows running tests without building while ensuring npm users get working JavaScript.

### File Conventions

| File | Location | Committed |
|------|----------|-----------|
| Main config | `omni.toml` | Yes |
| Local overrides | `omni.local.toml` | No |
| Lock file | `omni.lock.toml` | Yes |
| Runtime directory | `.omni/` | No |
| Installed capabilities | `.omni/capabilities/` | No |
| State files | `.omni/state/` | No |
| Provider state | `.omni/state/providers.json` | No |
| Active profile | `.omni/state/active-profile` | No |

## Key Files

### Core Package

| File | Purpose |
|------|---------|
| `packages/core/src/config/loader.ts` | Config loading and merging |
| `packages/core/src/capability/sources.ts` | Git and file source fetching |
| `packages/core/src/capability/registry.ts` | Capability discovery and loading |
| `packages/core/src/capability/loader.ts` | Individual capability loading |
| `packages/core/src/sync.ts` | Orchestrates sync process, builds SyncBundle |
| `packages/core/src/state/providers.ts` | Provider state management |
| `packages/core/src/types/index.ts` | Type definitions (incl. adapter interfaces) |

### Adapters Package

| File | Purpose |
|------|---------|
| `packages/adapters/src/registry.ts` | Adapter discovery and lookup |
| `packages/adapters/src/claude-code/index.ts` | Claude Code adapter |
| `packages/adapters/src/cursor/index.ts` | Cursor adapter |
| `packages/adapters/src/codex/index.ts` | Codex adapter |
| `packages/adapters/src/opencode/index.ts` | OpenCode adapter |

### CLI Package

| File | Purpose |
|------|---------|
| `packages/cli/src/commands/init.ts` | Project initialization |
| `packages/cli/src/commands/sync.ts` | Sync command |
| `packages/cli/src/commands/profile.ts` | Profile management |
| `packages/cli/src/commands/provider.ts` | Provider enable/disable/list |
| `packages/cli/src/commands/doctor.ts` | Setup verification |


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

- Use `setupTestDir()` from `@omnidev-ai/core/test-utils` for temp dirs + cleanup
- Prefer `testDir.path` for filesystem work and `testDir.reset()` when you need a fresh dir mid-test
- Mock `process.exit` for CLI tests
- Use `beforeEach`/`afterEach` only for test-specific setup (mocks, fixtures), not temp dir cleanup

Example:

```ts
import { setupTestDir } from "@omnidev-ai/core/test-utils";

describe("example", () => {
	const testDir = setupTestDir("example-test-", { chdir: true, createOmniDir: true });

	test("writes files", async () => {
		await Bun.write("omni.toml", "project = \"test\"");
		expect(await Bun.file("omni.toml").text()).toContain("project");
		expect(testDir.path).toContain("example-test-");
	});
});
```

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
5. **Open a PR** against `main` (direct pushes to `main` are blocked)

We use PR and issue templates to keep reviews and reports consistent.

### Commit Messages

Use clear, descriptive commit messages:

```
add file:// protocol support for capability sources

- Add FileCapabilitySourceConfig type
- Implement parseFilePath() for file:// URLs
- Add content hash tracking for change detection
- Update lock file format for file sources
```

Optional: enable the commit message template locally:

```bash
git config commit.template .gitmessage
```

## Roadmap

### Completed
- Bun monorepo setup
- Code quality infrastructure (Biome, Lefthook)
- Testing infrastructure
- Core types and configuration
- Capability system (loader, skills, rules, docs)
- CLI package (Stricli)
- Ralph capability (AI orchestrator)
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
| Configuration | TOML ([smol-toml](https://github.com/nicolo-ribaudo/smol-toml)) |
| Linting | [Biome](https://biomejs.dev/) |
| Git Hooks | [Lefthook](https://github.com/evilmartians/lefthook) |

## Questions?

Open an issue for questions or discussion.
