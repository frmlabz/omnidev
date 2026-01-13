# OmniDev

> A meta-MCP that eliminates context bloat by exposing only **2 tools** to LLMs while providing unlimited power through a sandboxed coding environment.

## Why OmniDev?

LLMs are much better at writing code than calling tools. [Cloudflare's research](https://blog.cloudflare.com/code-mode/) explains why:

> The special tokens used in tool calls are things LLMs have never seen in the wild. They must be specially trained to use tools, based on synthetic training data. They aren't always that good at it... Meanwhile, LLMs are getting really good at writing code. In fact, LLMs asked to write code against the full, complex APIs normally exposed to developers don't seem to have too much trouble with it.
>
> LLMs have seen a lot of code. They have not seen a lot of "tool calls". Making an LLM perform tasks with tool calling is like putting Shakespeare through a month-long class in Mandarin and then asking him to write a play in it.

OmniDev embraces this by:

1. **Moving logic to a sandbox** — Instead of exposing dozens of MCP tools, LLMs write TypeScript code that runs in a Bun sandbox with full API access
2. **Context-aware capability loading** — Load only what you need. Frontend work? Skip backend/DB capabilities. Planning? Different skills than coding.

## The Two MCP Tools

### `omni_sandbox_environment`

Discover available sandbox tools with three levels of detail:

```json
// Level 1: Overview of all modules
{}

// Level 2: Module details with schemas
{ "capability": "tasks" }

// Level 3: Full tool specification
{ "capability": "tasks", "tool": "createTask" }
```

### `omni_execute`

Run TypeScript code with access to capability modules:

```json
{
  "code": "full contents of main.ts"
}
```

The LLM writes complete TypeScript files:

```typescript
import * as tasks from "tasks";

export async function main(): Promise<number> {
  await tasks.createTask({
    title: "Review PR #123",
    priority: "high"
  });
  return 0;
}
```

Response includes `stdout`, `stderr`, `exit_code`, `changed_files`, and `diff_stat`.

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/omnidev.git
cd omnidev && bun install

# Initialize OmniDev in your project
omnidev init

# Check your setup
omnidev doctor

# Start the MCP server
omnidev serve
```

Run `omnidev --help` for all available commands.

## Project Structure

```
omnidev/
├── packages/
│   ├── core/           # Shared types, capability loader, config
│   ├── cli/            # Stricli CLI + commands
│   └── mcp/            # MCP server (omni_sandbox_environment, omni_execute)
├── capabilities/       # Built-in capabilities
│   ├── ralph/          # AI agent orchestrator for PRD-driven development
│   ├── tasks/          # Task management
│   └── context7/       # Documentation fetching
└── docs/               # Documentation
```

### User Project Structure (after `omnidev init`)

```
project-root/
└── .omni/
    ├── config.toml         # Project configuration and profiles
    ├── instructions.md     # Generated agent instructions
    ├── capabilities/       # Custom capabilities
    ├── state/              # Runtime state (gitignored)
    └── sandbox/            # Sandbox execution (gitignored)
```

## Capabilities

A capability is a directory containing:

```
capabilities/my-capability/
├── capability.toml     # Metadata & config (required)
├── definition.md       # Description (required)
├── index.ts            # Sandbox tool exports
├── types.d.ts          # Type definitions for LLM
├── skills/             # Agent behaviors (SKILL.md files)
└── rules/              # Guidelines (*.md files)
```

### Profiles

Switch capability sets for different workflows:

```toml
# .omni/config.toml
[profiles.default]
capabilities = ["tasks"]

[profiles.planning]
capabilities = ["ralph", "tasks"]

[profiles.frontend]
capabilities = ["tasks", "ui-design"]
```

## Development

```bash
bun run check        # typecheck + lint + format + test
bun test             # run tests
bun test --coverage  # with coverage report
```

## Roadmap

### ✅ Completed
- Bun monorepo setup
- Code quality infrastructure (Biome, Lefthook)
- Testing infrastructure
- Core types and configuration
- Capability system (loader, skills, rules, docs)
- CLI package (Stricli)
- MCP server package
- Ralph capability (AI orchestrator)
- MCP server wrapping

### 📋 Future
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

## License

MIT
