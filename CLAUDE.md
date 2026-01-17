# PROJECT KNOWLEDGE BASE

## OVERVIEW
OmniDev: CLI capability management system for AI agents. Manages external capabilities through profiles + optional MCP server for sandboxed TypeScript execution.

## STRUCTURE
```
./
├── packages/
│   ├── core/           # Shared types, config loader, capability registry
│   ├── cli/            # CLI commands (init, sync, doctor, profile, serve)
│   └── mcp/            # MCP server (optional, omni_sandbox_environment, omni_execute)
├── scripts/            # Development & build scripts
├── docs/               # Documentation
└── .agent/             # AI agent configuration
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Config loader | packages/core/src/config/ | Loads omni.toml, omni.local.toml |
| Capability registry | packages/core/src/capability/ | Discovers & loads from external sources |
| CLI commands | packages/cli/src/commands/ | init, sync, doctor, profile, capability, serve |
| MCP tools | packages/mcp/src/tools/ | omni_sandbox_environment, omni_execute |
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
- Custom helpers: `@omnidev-ai/core/test-utils` (expectToThrowAsync, waitForCondition)
- Pre-commit: typecheck → lint → format → test --bail
- Test organization: 33 test files across packages (21 core, 5 cli, 5 mcp, 2 test-utils)

**Test Setup Pattern (STANDARD):**
```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "@omnidev-ai/core/test-utils";

describe("feature being tested", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("test-prefix-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("description", () => {
		// Test implementation
	});
});
```

**Test Naming Conventions:**
- Use `let testDir: string;` (camelCase) - most common (17 files, 68%)
- Prefixes: descriptive, e.g., `"capability-test-"`, `"registry-test-"`, `"init-test-"`
- Avoid: `TEST_DIR`, `tempDir` (inconsistent, used in only 8 files combined)

**Import Consistency:**
- Core package: `import { tmpdir } from "../test-utils/index.js";` (relative)
- MCP/CLI packages: `import { tmpdir } from "@omnidev-ai/core/test-utils";` (workspace)
- PREFERENCE: Use workspace import `@omnidev-ai/core/test-utils` for new code

**Working Directory Management:**
- ALWAYS save `originalCwd` before changing directories
- Restore in `afterEach` before cleanup
- Use `beforeEach`/`afterEach` hooks from `"bun:test"`

**Cleanup Best Practices:**
- Check existence before deletion: `if (existsSync(testDir))`
- Use `{ recursive: true, force: true }` options
- Clean up in `afterEach`, never in `test` functions

**Directory Listing Sorting (CRITICAL):**
- `readdirSync` and `readdir` results MUST be sorted for deterministic test behavior
- Tests accessing array indices (e.g., `expect(rules[0]?.name)`) will fail randomly without sorting
- Apply to ALL directory listings:
```typescript
const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
);
```

**Test Structure Patterns:**
- Group related tests with `describe()` blocks
- Test names: clear, descriptive, present tense
- Use `expect(async () => ...).toThrow()` for async errors
- Console mocking: capture output with `captureConsole()` helper
- Spies/mocks: use `createSpy()`, `createMockFn()` from test-utils

**Existing Inconsistencies (Legacy):**
- Variable naming: 3 patterns exist (`testDir`, `TEST_DIR`, `tempDir`)
- Import style: core uses relative imports, mcp/cli use workspace
- originalCwd: 5 files use `const`, 20 use `let`
- Cleanup: 15 files check existence, 10 don't
- These should be normalized to standard pattern over time

**Module Organization:**
- Packages export via `index.ts` with barrel exports
- Workspace paths: `@omnidev-ai/core`, `@omnidev-ai/cli`, `@omnidev-ai/mcp`

**Changesets:**
- Use `bun run changeset` to create changesets for any publishable change
- Group changes: patch (fix), minor (feature), major (breaking)
- Changesets are tracked in `.changeset/` and applied during release
- Core + CLI are "fixed" (released together), MCP is ignored (not published)

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `any` type - TypeScript strict mode enforced
- **NEVER** commit build artifacts - Bun runtime doesn't need builds
- **NEVER** skip pre-commit hooks - quality gates required
- **NEVER** add `.omni/` to root gitignore - internal `.omni/.gitignore` controls what's ignored

## COMMANDS
```bash
bun run check          # typecheck + lint + format + test
bun run typecheck      # TypeScript only
bun run lint           # Biome lint (fix auto)
bun run format         # Biome format (fix auto)
bun test               # Run all tests
bun test:coverage      # With coverage report (target: 70%)

bun run changeset      # Create a changeset for version bump
bun run version        # Apply changesets to package versions
bun run release        # Build + prepare + publish to npm
```

## NOTES

**Capability System:**
- Capabilities loaded from external sources (Git, file://) to `.omni/capabilities/`
- Managed via omni.toml, locked via omni.lock.toml
- Can export CLI commands and sandbox-accessible functions

**TOML Configuration:**
- All config files use TOML (not JSON/YAML)
- Files: `omni.toml` (main), `omni.local.toml` (overrides), `omni.lock.toml` (versions)

**Git Hooks:**
- Lefthook manages pre-commit hooks
- Runs sequentially: typecheck → lint → format → test
- Use `git commit --no-verify` to bypass (not recommended)

**Nix/Direnv:**
- `flake.nix` provides reproducible dev environment
- `.envrc` auto-loads with `use flake`
- Optional: can run without Nix using bun directly
