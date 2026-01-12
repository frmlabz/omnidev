# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-12T10:36:46
**Commit:** (not specified)
**Branch:** (not specified)

## OVERVIEW
OmniDev: meta-MCP system exposing 2 tools to LLMs (omni_query, omni_execute) while providing unlimited power through sandboxed TypeScript execution on Bun runtime.

## STRUCTURE
```
./
├── packages/
│   ├── core/           # Shared types, capability system, config loader
│   ├── cli/            # Stricli CLI + commands
│   └── mcp/            # MCP server (omni_query, omni_execute)
├── capabilities/       # Plugin packages (ralph, tasks, context7)
├── scripts/            # Development & ralph scripts
├── docs/               # Documentation
└── .agent/             # AI agent configuration
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Capability loader | packages/core/src/capability/loader.ts | Discovers & loads capabilities from .omni/capabilities/ |
| CLI commands | packages/cli/src/commands/ | Static core commands (init, serve, doctor) |
| MCP tools | packages/mcp/src/tools/ | omni_query, omni_execute implementations |
| Ralph orchestrator | capabilities/ralph/ | PRD-driven AI agent orchestration |
| Build/test | package.json scripts | Uses bun test, biome for linting |

## CONVENTIONS

**Runtime:**
- Bun runtime (no Node.js build step)
- TypeScript imported directly via `allowImportingTsExtensions`
- All package exports point to `.ts` source files

**Code Style:**
- Biome formatter: tabs, 100 char line width
- Double quotes, semicolons always
- No `any` types (Biome: noExplicitAny = error)

**Testing:**
- Bun native test runner (`bun test`)
- Tests co-located: `*.test.ts` next to source
- Custom helpers: `@omnidev/core/test-utils` (expectToThrowAsync, waitForCondition)
- Pre-commit: typecheck → lint → format → test --bail

**Module Organization:**
- Packages export via `index.ts` with barrel exports
- Capabilities must export `CapabilityExport` interface
- Workspace paths: `@omnidev/core`, `@omnidev/cli`, `@omnidev/mcp`

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `any` type - TypeScript strict mode enforced
- **NEVER** commit build artifacts - Bun runtime doesn't need builds
- **NEVER** skip pre-commit hooks - quality gates required
- **NEVER** add `.omni/` to root gitignore - internal `.omni/.gitignore` controls what's ignored
- **NEVER** modify generated files in `.omni/generated/` - auto-synced via `omnidev agents sync`

## COMMANDS
```bash
bun run check          # typecheck + lint + format + test
bun run typecheck      # TypeScript only
bun run lint           # Biome lint (fix auto)
bun run format         # Biome format (fix auto)
bun test               # Run all tests
bun test:coverage      # With coverage report (target: 70%)
```

## NOTES

**Capability System:**
- Capabilities are directories in `.omni/capabilities/` with `capability.toml` + `index.ts`
- Export `cliCommands`, `sandboxTools`, `gitignore`, `sync` via `CapabilityExport`
- Can export sandbox-accessible functions with JSON schemas (see `capabilities/tasks`)

**TOML Configuration:**
- All config files use TOML (not JSON/YAML)
- Inline comments explain each setting
- Files: `config.toml`, `provider.toml`, `capabilities.toml`, `profiles.toml`

**Git Hooks:**
- Lefthook manages pre-commit hooks
- Runs sequentially: typecheck → lint → format → test
- Use `git commit --no-verify` to bypass (not recommended)

**Nix/Direnv:**
- `flake.nix` provides reproducible dev environment
- `.envrc` auto-loads with `use flake`
- Optional: can run without Nix using bun directly
