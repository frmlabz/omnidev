# PRD-002: Code Quality Infrastructure

**Status:** Ready  
**Priority:** 2 (Foundation - Right after monorepo setup)  
**Estimated Effort:** Medium

---

## Introduction / Overview

Set up comprehensive code quality tooling for the OmniDev monorepo. This includes linting with Biome, formatting, type checking, and git hooks to enforce quality on every commit. This ensures that Ralph (and all contributors) maintain consistent code quality throughout development.

The key principle: **Every commit must pass all quality checks.** Ralph should run these checks and only commit when they pass.

---

## Goals

- Configure Biome for linting and formatting across all packages
- Set up git hooks using Lefthook to run checks on pre-commit
- Create npm scripts for running checks individually and together
- Ensure IDE integration works (VSCode/Cursor)
- Document the quality gates in the project

---

## User Stories

### US-001: Install and Configure Biome

**Description:** As a developer, I need Biome configured for linting and formatting so that code style is consistent across the project.

**Acceptance Criteria:**
- [ ] Biome is installed as a dev dependency at root
- [ ] `biome.json` configuration file exists at root
- [ ] Biome is configured for TypeScript with strict rules
- [ ] Biome ignores `node_modules`, `dist`, and generated files
- [ ] Typecheck passes

---

### US-002: Create Quality Check Scripts

**Description:** As a developer, I need npm scripts to run quality checks so that I can verify code before committing.

**Acceptance Criteria:**
- [ ] `bun run lint` - runs Biome lint check
- [ ] `bun run lint:fix` - runs Biome lint with auto-fix
- [ ] `bun run format` - formats code with Biome
- [ ] `bun run format:check` - checks formatting without modifying
- [ ] `bun run check` - runs typecheck + lint + format:check together
- [ ] All scripts work from root and apply to all packages
- [ ] Typecheck passes

---

### US-003: Set Up Lefthook Git Hooks

**Description:** As a developer, I need git hooks that automatically run quality checks before commits so that bad code never gets committed.

**Acceptance Criteria:**
- [ ] Lefthook is installed as a dev dependency
- [ ] `lefthook.yml` configuration exists at root
- [ ] Pre-commit hook runs: typecheck, lint, format:check
- [ ] Hooks are installed automatically via `bun install` postinstall script
- [ ] Commits are blocked if any check fails
- [ ] Typecheck passes

---

### US-004: Configure VSCode/Cursor Integration

**Description:** As a developer, I need IDE settings so that Biome runs automatically and formatting happens on save.

**Acceptance Criteria:**
- [ ] `.vscode/settings.json` exists with Biome as default formatter
- [ ] Format on save is enabled for TypeScript files
- [ ] `.vscode/extensions.json` recommends Biome extension
- [ ] IDE shows lint errors inline
- [ ] Typecheck passes

---

### US-005: Verify All Quality Gates Work Together

**Description:** As a developer, I need to verify the complete quality pipeline works end-to-end.

**Acceptance Criteria:**
- [ ] `bun run check` passes on all existing code
- [ ] Intentionally bad code triggers lint errors
- [ ] Intentionally unformatted code triggers format check failure
- [ ] Pre-commit hook blocks commits with errors
- [ ] All quality checks complete in under 10 seconds
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** Biome must enforce consistent code style (semicolons, quotes, indentation)
- **FR-2:** Biome must catch common TypeScript errors and anti-patterns
- **FR-3:** Git hooks must run automatically on every commit attempt
- **FR-4:** Git hooks must block commits that fail any quality check
- **FR-5:** All quality checks must be runnable individually via npm scripts
- **FR-6:** A single `check` script must run all quality checks in sequence
- **FR-7:** Quality checks must complete quickly (< 10s for full check)

---

## Non-Goals (Out of Scope)

- ❌ No test running in pre-commit (tests are separate)
- ❌ No CI/CD pipeline configuration
- ❌ No spell checking
- ❌ No commit message linting (conventional commits)
- ❌ No branch protection rules

---

## Technical Considerations

### Biome Configuration (`biome.json`)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "semicolons": "always",
      "quoteStyle": "single"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      ".omni",
      "*.generated.*"
    ]
  }
}
```

### Lefthook Configuration (`lefthook.yml`)

```yaml
pre-commit:
  parallel: false
  commands:
    typecheck:
      glob: "*.{ts,tsx}"
      run: bun run typecheck
    lint:
      glob: "*.{ts,tsx,js,jsx,json}"
      run: bun run lint
    format:
      glob: "*.{ts,tsx,js,jsx,json,md}"
      run: bun run format:check
```

### Root package.json Scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "biome lint .",
    "lint:fix": "biome lint --write .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "check": "bun run typecheck && bun run lint && bun run format:check",
    "prepare": "lefthook install"
  }
}
```

### VSCode Settings (`.vscode/settings.json`)

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Touchpoints

Files to create or modify:

### Root Level
- `biome.json` - Biome configuration (CREATE)
- `lefthook.yml` - Git hooks configuration (CREATE)
- `package.json` - Add scripts and devDependencies (MODIFY)

### VSCode/Cursor
- `.vscode/settings.json` - Editor settings (CREATE)
- `.vscode/extensions.json` - Recommended extensions (CREATE)

---

## Dependencies

- ✅ PRD-001: Bun Monorepo Setup (must be completed first)
- Biome: `@biomejs/biome` (latest)
- Lefthook: `lefthook` (latest)

---

## Success Metrics

- `bun run check` passes on clean codebase
- Pre-commit hook blocks intentionally bad commits
- IDE shows lint errors in real-time
- Format on save works in VSCode/Cursor
- Full quality check completes in under 10 seconds

---

## Implementation Notes

### Suggested Implementation Order

1. **Install Biome** - add to devDependencies
2. **Configure Biome** - create biome.json
3. **Add scripts** - lint, format, check scripts
4. **Install Lefthook** - add to devDependencies  
5. **Configure Lefthook** - create lefthook.yml
6. **Add prepare script** - auto-install hooks
7. **VSCode settings** - create .vscode directory and files
8. **Verify pipeline** - test all checks work

### Validation Commands

```bash
# Run all checks
bun run check

# Individual checks
bun run typecheck
bun run lint
bun run format:check

# Auto-fix issues
bun run lint:fix
bun run format

# Test git hooks (should fail on bad code)
echo "const x = 1; x = 2;" > test-bad.ts
git add test-bad.ts
git commit -m "test"  # Should fail
rm test-bad.ts
```

---

## Codebase Patterns

Ralph should follow these patterns for this PRD:

- Use `bun add -d` for dev dependencies
- Put all config files at the root level
- Use `bun run` not `npm run`
- Test that hooks are installed by checking `.git/hooks/pre-commit`

---

