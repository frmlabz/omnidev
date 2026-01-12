# CLI COMMANDS

**Generated:** 2026-01-12
**Location:** packages/cli/src/commands/

## OVERVIEW
Static CLI commands built with Stricli framework for OmniDev project management.

## WHERE TO LOOK
| Command | File | Purpose |
|---------|------|---------|
| `omnidev init` | init.ts | Creates .omni/ directory, config.toml, provider.toml, instructions.md, internal gitignore |
| `omnidev serve` | serve.ts | Starts MCP server via @omnidev/mcp, optional --profile flag sets active profile |
| `omnidev doctor` | doctor.ts | Validates Bun version (≥1.0), .omni/ directory, config.toml, internal gitignore |
| `omnidev capability` | capability.ts | Subcommands: list, enable <name>, disable <name> (auto-syncs on enable/disable) |
| `omnidev profile` | profile.ts | Subcommands: list, set <name> (auto-syncs on set, shows active with ● indicator) |
| `omnidev ralph` | ralph.ts | Orchestrator: init, start [--agent/--iterations/--prd], stop, status; prd/story/spec/log/patterns subcommands |
| `omnidev sync` | sync.ts | Manual agent configuration sync (capabilities, skills, rules, .omni/.gitignore) |
| `omnidev mcp status` | mcp.ts | Shows MCP controller status from .omni/state/mcp-status.json |

## CONVENTIONS

**Command Structure:**
- All commands use Stricli's `buildCommand()` or `buildRouteMap()` from `@stricli/core`
- Commands import from `@omnidev/core` for config loading, capability management
- Route maps exported as `xxxRoutes` for subcommands (e.g., `capabilityRoutes`, `ralphRoutes`)

**State Management:**
- State-changing commands (capability enable/disable, profile set) auto-call `syncAgentConfiguration()`
- Commands validate `.omni/` exists before attempting operations
- Error handling: console.error() + process.exit(1)

**Output Style:**
- ✓ for success, ✗ for failure, ● for active items
- Brief fix suggestions for doctor check failures

## ANTI-PATTERNS

- **NEVER** add static commands to app.ts - dynamic capability commands loaded via dynamic-app.ts
- **NEVER** skip syncAgentConfiguration() after state changes - keeps agent configs in sync
- **NEVER** assume .omni/ exists - check with existsSync() before loading config
- **NEVER** use any for flags - Stricli parameters define types explicitly
- **NEVER** hardcode agent commands in ralph.ts - loaded from capabilities/ralph/index.js
