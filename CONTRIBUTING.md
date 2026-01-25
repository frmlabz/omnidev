# Contributing to OmniDev

## ⚠️ AI Coding Policy

**AI-assisted coding is welcome, hell we used it heavily for this project, but you are ultimately responsible for the correctness and quality of your contributions.**

If you submit code that was written by an LLM, you must:
- **Review it thoroughly** - Understand the code before submitting
- **Ensure it works** - Test it properly and verify it solves the intended problem
- **Maintain quality standards** - Follow our code style, add tests, and ensure type safety
- **Take ownership** - You're responsible for the code you submit

**Low-quality contributions** (untested, broken code, or code the submitter doesn't understand) will be flagged and may result in your account being restricted from making future contributions.

Thank you for understanding and contributing to OmniDev!

---

## Before Making Contributions

**Please open an issue first** before making substantial changes or starting new work. This allows us to:
- Discuss whether the change aligns with the project's direction
- Coordinate with other contributors and avoid duplicate work
- Provide guidance and save you time

If an issue already exists for your intended work, please claim it or reference it in your PR.

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/frmlabz/omnidev.git
cd omnidev

# Install dependencies
bun install

# Run all checks (typecheck + lint + format)
bun run check

# Run all tests (coverage + integration)
bun run test:all
```

### Available Scripts

```bash
# Type checking
bun run typecheck

# Linting and formatting
bun run lint          # Lint and fix issues
bun run format         # Format code
bun run lint:fix       # Fix linting issues
bun run format:fix     # Fix formatting issues

# Testing
bun run test                       # Run unit tests
bun run test:coverage              # Run tests with coverage
bun run test:watch                 # Watch mode
bun run test:integration           # Run Docker integration tests
bun run test:all                   # Full test suite (coverage + integration)

# Build
bun run build          # Build all packages

# Clean
bun run clean          # Remove build artifacts
```

---

## Project Structure

```
omnidev/
├── packages/
│   ├── core/           # Core capabilities (not published)
│   ├── cli/            # Command-line interface (Stricli)
│   ├── adapters/       # Provider-specific file writers
│   └── capability/     # Capability development kit (CLI + types)
├── capabilities/       # Built-in capabilities
│   ├── ralph/          # AI orchestrator for PRD-driven development
│   └── tasks/          # Task management
├── examples/           # Runnable example configurations (CI tested)
├── tests/
│   └── integration/    # Docker integration tests
└── scripts/            # Helper scripts
```

### Key Directories

- **`test/integration/`** - Docker-based end-to-end tests that validate CLI flows in clean containers
- **`examples/`** - Example `omni.toml` configurations that are CI-tested and must always be runnable
- **`capabilities/`** - Built-in capabilities included with OmniDev

---

## Package Overview

**`@omnidev-ai/core`** (not published)
- Shared types and configuration loading
- Capability registry and loader
- Provider state management
- Core interfaces

**`@omnidev-ai/adapters`**
- Provider-specific file writers
- Transforms `SyncBundle` into provider-specific files
- Writers for Claude, Cursor, Codex, OpenCode

**`@omnidev-ai/cli`**
- Main CLI commands (`init`, `sync`, `doctor`, `profile`, `capability`, `provider`)
- Built with [Stricli](https://bloomberg.github.io/stricli/)

**`@omnidev-ai/capability`**
- CLI commands for capability development (`capability new`, `capability build`)
- Library exports types and utilities for building capabilities

---

## Architecture

### Provider Adapter Layer

OmniDev uses a **Writer-based** architecture to transform provider-agnostic content into provider-specific files:

```
┌─────────────────────────────────────────────────────┐
│                    Core                             │
│  ┌─────────────┐    ┌─────────────┐                 │
│  │  Capability │───▶│ SyncBundle  │                 │
│  │   Registry  │    │  (agnostic) │                 │
│  └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Claude     │  │   Cursor     │  │   Codex      │
│   Writers    │  │   Writers    │  │   Writers    │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Key concepts:**
- **SyncBundle**: Provider-agnostic data structure with all capabilities, skills, rules, etc.
- **Writers**: Stateless functions that transform SyncBundle into provider-specific files
- **Writer deduplication**: Same writer with same output path only executes once

### Capability Sources

Capabilities can come from two sources:

1. **Git sources** — Cloned to `.omni/capabilities/`, tracked by commit hash and (optional) version
2. **File sources** — Copied to `.omni/capabilities/`, tracked by content hash

The lock file (`omni.lock.toml`) ensures reproducible builds by tracking:

```toml
[capabilities.my-cap]
source = "github:user/repo"
version = "1.0.0"
commit = "abc123def..."
updated_at = "2026-01-16T..."
```

This system enables configuration versioning and ensures that `omni sync` produces consistent outputs across runs.

---

## Examples

The `examples/` directory contains runnable `omni.toml` configurations that are CI-tested on every push/PR.

**Important**: Examples are not just demonstrations—they must always work. When adding new functionality:
1. Create or update an example that uses the feature
2. Ensure the example passes CI tests
3. Keep examples simple and self-contained

See [examples/README.md](examples/README.md) for detailed documentation.

---

## Testing

We have three levels of testing:

### Unit Tests
Co-located with source files (`*.test.ts`)

```bash
bun test ./packages
```

### Integration Tests
Docker-based end-to-end tests in `tests/integration/`

```bash
bun run test:integration
# or
bash tests/integration/run.sh dev
```

Integration tests validate:
- CLI flows (`init`, `sync`, `add cap`, `add mcp`)
- Profile switching and capability toggling
- Generated files and synced capabilities
- Doctor command validation

### Example Tests
Validates that all example configurations work correctly

```bash
bun test ./examples
```

### Test Patterns

- Use `setupTestDir()` from `@omnidev-ai/core/test-utils` for temp directories
- Prefer `testDir.path` for filesystem work and `testDir.reset()` when you need a fresh directory mid-test
- Mock `process.exit` for CLI tests
- Use `beforeEach`/`afterEach` only for test-specific setup (not temp dir cleanup)

---

## Code Quality

We use [Biome](https://biomejs.dev/) for linting and formatting.

### Mandatory Checks

Before submitting a PR, you must:

1. **Type check**: `bun run typecheck`
2. **Lint**: `bun run lint`
3. **Format**: `bun run format`
4. **All tests pass**: `bun run test:all`

```bash
# Run everything
bun run check && bun run test:all
```

Git hooks (via [Lefthook](https://github.com/evilmartians/lefthook)) run these checks on commit.

---

## Making Changes

1. **Open an issue** or claim an existing one (for non-trivial changes)
2. **Create a branch** from `main`
3. **Make your changes** with tests
4. **Run checks**: `bun run check && bun run test:all`
5. **Commit** with a descriptive message
6. **Open a PR** against `main` (direct pushes to `main` are blocked)

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

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh) |
| CLI Framework | [Stricli](https://bloomberg.github.io/stricli/) |
| Configuration | TOML ([smol-toml](https://github.com/nicolo-ribaudo/smol-toml)) |
| Linting | [Biome](https://biomejs.dev/) |
| Git Hooks | [Lefthook](https://github.com/evilmartians/lefthook) |

---

## Questions?

Open an issue for questions or discussion.
