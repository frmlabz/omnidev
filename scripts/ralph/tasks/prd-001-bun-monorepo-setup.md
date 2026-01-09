# PRD-001: Bun Monorepo Foundation

**Status:** Ready  
**Priority:** 1 (Foundation - Must be done first)  
**Estimated Effort:** Medium

---

## Introduction / Overview

Set up the foundational Bun monorepo structure for OmniDev. This is the critical first step that establishes the workspace architecture, package structure, and basic configuration. Everything else builds on top of this foundation.

OmniDev is a meta-MCP (Model Context Protocol) that exposes only 2 tools to LLMs while providing unlimited power through capabilities. The monorepo will contain three main packages: `core`, `cli`, and `mcp`.

---

## Goals

- Create a proper Bun workspace monorepo structure
- Set up the three main packages: `packages/core`, `packages/cli`, `packages/mcp`
- Configure TypeScript for the monorepo with shared configuration
- Set up package.json files with proper workspace references
- Create a placeholder `capabilities/tasks` directory for the built-in capability
- Ensure `bun install` works and dependencies are hoisted correctly

---

## User Stories

### US-001: Initialize Root Workspace

**Description:** As a developer, I need a properly configured Bun workspace root so that all packages share dependencies efficiently.

**Acceptance Criteria:**
- [ ] Root `package.json` exists with `workspaces: ["packages/*", "capabilities/*"]`
- [ ] Root `package.json` has `"private": true` and `"type": "module"`
- [ ] `bunfig.toml` exists with workspace configuration
- [ ] `bun install` runs successfully from root
- [ ] Typecheck passes

---

### US-002: Create Core Package Structure

**Description:** As a developer, I need the core package scaffolded so that shared logic has a home.

**Acceptance Criteria:**
- [ ] `packages/core/package.json` exists with name `@omnidev/core`
- [ ] `packages/core/tsconfig.json` extends root config
- [ ] `packages/core/src/index.ts` exists with placeholder export
- [ ] Package is importable from other workspace packages
- [ ] Typecheck passes

---

### US-003: Create CLI Package Structure

**Description:** As a developer, I need the CLI package scaffolded so that command-line functionality has a home.

**Acceptance Criteria:**
- [ ] `packages/cli/package.json` exists with name `@omnidev/cli`
- [ ] `packages/cli/package.json` has dependency on `@omnidev/core`
- [ ] `packages/cli/tsconfig.json` extends root config
- [ ] `packages/cli/src/index.ts` exists with placeholder
- [ ] Package can import from `@omnidev/core`
- [ ] Typecheck passes

---

### US-004: Create MCP Package Structure

**Description:** As a developer, I need the MCP server package scaffolded so that the MCP server functionality has a home.

**Acceptance Criteria:**
- [ ] `packages/mcp/package.json` exists with name `@omnidev/mcp`
- [ ] `packages/mcp/package.json` has dependency on `@omnidev/core`
- [ ] `packages/mcp/tsconfig.json` extends root config
- [ ] `packages/mcp/src/index.ts` exists with placeholder
- [ ] Package can import from `@omnidev/core`
- [ ] Typecheck passes

---

### US-005: Create Tasks Capability Placeholder

**Description:** As a developer, I need a placeholder for the built-in tasks capability so that the capability structure is established.

**Acceptance Criteria:**
- [ ] `capabilities/tasks/package.json` exists with name `tasks`
- [ ] `capabilities/tasks/capability.toml` exists with basic metadata
- [ ] `capabilities/tasks/index.ts` exists with placeholder export
- [ ] Capability is part of the workspace
- [ ] Typecheck passes

---

### US-006: Configure Root TypeScript

**Description:** As a developer, I need a shared TypeScript configuration so that all packages have consistent type checking.

**Acceptance Criteria:**
- [ ] Root `tsconfig.json` with strict settings exists
- [ ] `tsconfig.json` has `compilerOptions.paths` for workspace packages
- [ ] `tsconfig.json` targets ES2022+ for modern features
- [ ] All packages extend or reference root config
- [ ] `bun run typecheck` works from root
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** The monorepo must use Bun workspaces, not npm/yarn/pnpm
- **FR-2:** All packages must use ESM (`"type": "module"`)
- **FR-3:** TypeScript must be in strict mode across all packages
- **FR-4:** Packages must be able to import each other using workspace protocol (`workspace:*`)
- **FR-5:** The root `package.json` must define scripts: `typecheck`, `build`, `clean`
- **FR-6:** Each package must have its own `tsconfig.json` that extends the root
- **FR-7:** Dependencies common to all packages should be hoisted to root

---

## Non-Goals (Out of Scope)

- ❌ No actual implementation of core/cli/mcp functionality yet
- ❌ No linting/formatting setup (separate PRD)
- ❌ No testing setup (separate PRD)
- ❌ No CI/CD configuration
- ❌ No git hooks (separate PRD)
- ❌ No README documentation

---

## Technical Considerations

### Directory Structure (Target)

```
omnidev/
├── package.json              # Workspace root
├── bunfig.toml              # Bun configuration
├── tsconfig.json            # Shared TypeScript config
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   └── mcp/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
└── capabilities/
    └── tasks/
        ├── package.json
        ├── capability.toml
        └── index.ts
```

### Package.json Scripts (Root)

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "bun run --filter '*' build",
    "clean": "rm -rf packages/*/dist capabilities/*/dist"
  }
}
```

### TypeScript Configuration

Use these settings for strict, modern TypeScript:
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `target: "ES2022"`
- `module: "ESNext"`
- `moduleResolution: "bundler"`

### Bun-Specific Notes

- Bun natively supports TypeScript, no compilation step needed for development
- Use `bun run` instead of `npm run`
- Bun's package resolution is compatible with Node.js

---

## Success Metrics

- `bun install` completes without errors
- `bun run typecheck` passes
- Each package can import from `@omnidev/core`
- IDE (Cursor/VSCode) recognizes workspace imports
- No TypeScript errors in any package

---

## Dependencies

- ✅ Bun runtime (assumed installed via flake.nix)
- ✅ TypeScript (will be installed as dev dependency)

---

## Implementation Notes

### Suggested Implementation Order

1. **Root workspace setup** - package.json, bunfig.toml
2. **TypeScript config** - root tsconfig.json
3. **Core package** - the foundation all others depend on
4. **CLI package** - depends on core
5. **MCP package** - depends on core
6. **Tasks capability** - standalone but part of workspace

### Key Files to Create

1. `/package.json` - workspace root
2. `/bunfig.toml` - bun configuration
3. `/tsconfig.json` - shared typescript config
4. `/packages/core/package.json`
5. `/packages/core/tsconfig.json`
6. `/packages/core/src/index.ts`
7. `/packages/cli/package.json`
8. `/packages/cli/tsconfig.json`
9. `/packages/cli/src/index.ts`
10. `/packages/mcp/package.json`
11. `/packages/mcp/tsconfig.json`
12. `/packages/mcp/src/index.ts`
13. `/capabilities/tasks/package.json`
14. `/capabilities/tasks/capability.toml`
15. `/capabilities/tasks/index.ts`

---

## Validation Commands

After implementation, these commands must succeed:

```bash
# Install dependencies
bun install

# Type check all packages
bun run typecheck

# Verify package imports work
bun run --filter @omnidev/cli typecheck
bun run --filter @omnidev/mcp typecheck
```

---

