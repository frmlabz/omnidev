# PRD-003: Testing Infrastructure

**Status:** Ready  
**Priority:** 3 (Foundation - After code quality)  
**Estimated Effort:** Medium

---

## Introduction / Overview

Set up comprehensive testing infrastructure for the OmniDev monorepo using Bun's built-in test runner. This includes unit testing setup, coverage reporting, and test utilities. The goal is to achieve and maintain 70%+ code coverage across all packages.

Testing is critical for Ralph's autonomous development - every feature must include tests, and tests must pass before code is committed.

---

## Goals

- Configure Bun's built-in test runner for all packages
- Set up code coverage reporting with a 70% threshold
- Create shared test utilities and helpers
- Establish testing patterns and conventions
- Add test scripts that work across the monorepo

---

## User Stories

### US-001: Configure Bun Test Runner

**Description:** As a developer, I need the Bun test runner configured so that I can write and run tests.

**Acceptance Criteria:**
- [ ] `bun test` works from the root directory
- [ ] Tests are discovered in all packages (`**/*.test.ts`)
- [ ] Test configuration in `bunfig.toml` is set up
- [ ] Tests can import from workspace packages
- [ ] Typecheck passes

---

### US-002: Set Up Code Coverage

**Description:** As a developer, I need code coverage reporting so that I can ensure adequate test coverage.

**Acceptance Criteria:**
- [ ] `bun test --coverage` produces coverage report
- [ ] Coverage report shows line, branch, and function coverage
- [ ] Coverage threshold is set to 70%
- [ ] Coverage excludes test files and type definitions
- [ ] Typecheck passes

---

### US-003: Create Test Utilities Package

**Description:** As a developer, I need shared test utilities so that I can write tests consistently across packages.

**Acceptance Criteria:**
- [ ] Test utility functions exist for common operations
- [ ] Mock factories for creating test data
- [ ] Helper for testing async functions
- [ ] Utilities are importable from all packages
- [ ] Typecheck passes

---

### US-004: Add Test Scripts to Packages

**Description:** As a developer, I need test scripts in each package so that I can run tests per-package or for all packages.

**Acceptance Criteria:**
- [ ] Root `package.json` has `test` and `test:coverage` scripts
- [ ] Each package has its own `test` script
- [ ] `bun run test` from root runs all tests
- [ ] `bun run test:coverage` shows coverage report
- [ ] Typecheck passes

---

### US-005: Write Example Tests

**Description:** As a developer, I need example tests so that I have templates for writing new tests.

**Acceptance Criteria:**
- [ ] At least one test file exists in `packages/core/src`
- [ ] Example test demonstrates unit testing pattern
- [ ] Example test demonstrates async testing
- [ ] Example test uses test utilities
- [ ] All example tests pass
- [ ] Typecheck passes

---

### US-006: Add Test Running to Git Hooks

**Description:** As a developer, I need tests to run before commits so that broken code is never committed.

**Acceptance Criteria:**
- [ ] Lefthook pre-commit includes test running
- [ ] Tests run after lint/format checks
- [ ] Commits are blocked if tests fail
- [ ] Test run is reasonably fast (< 30s for pre-commit)
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** Test files must follow the pattern `*.test.ts` or `*.spec.ts`
- **FR-2:** Tests must be discoverable automatically without explicit registration
- **FR-3:** Coverage must be measurable and reportable
- **FR-4:** Coverage threshold of 70% must be enforceable
- **FR-5:** Tests must be able to import from any workspace package
- **FR-6:** Test utilities must be reusable across packages
- **FR-7:** Tests must run in isolation (no shared state between tests)

---

## Non-Goals (Out of Scope)

- ❌ No E2E/integration testing setup (focus on unit tests)
- ❌ No visual regression testing
- ❌ No performance/benchmark testing
- ❌ No mutation testing
- ❌ No test database setup

---

## Technical Considerations

### Bun Test Configuration (`bunfig.toml` additions)

```toml
[test]
coverage = true
coverageThreshold = 0.7
coverageSkipSourceFiles = ["**/*.test.ts", "**/*.d.ts", "**/index.ts"]
```

### Root package.json Scripts

```json
{
  "scripts": {
    "test": "bun test",
    "test:coverage": "bun test --coverage",
    "test:watch": "bun test --watch"
  }
}
```

### Example Test File Structure

```typescript
// packages/core/src/utils.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { someFunction } from './utils';

describe('someFunction', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  test('should return expected value', () => {
    const result = someFunction('input');
    expect(result).toBe('expected');
  });

  test('should handle edge cases', () => {
    expect(() => someFunction('')).toThrow();
  });

  test('should work with async operations', async () => {
    const result = await someFunction('async');
    expect(result).resolves.toBe('value');
  });
});
```

### Test Utilities Location

```
packages/
└── core/
    └── src/
        └── test-utils/
            ├── index.ts         # Re-exports all utilities
            ├── mocks.ts         # Mock factories
            ├── fixtures.ts      # Test fixtures
            └── helpers.ts       # Helper functions
```

### Test Utility Examples

```typescript
// packages/core/src/test-utils/mocks.ts
export function createMockCapability(overrides = {}) {
  return {
    id: 'test-capability',
    name: 'Test Capability',
    version: '1.0.0',
    ...overrides,
  };
}

export function createMockConfig(overrides = {}) {
  return {
    project: 'test-project',
    capabilities: { enable: [] },
    ...overrides,
  };
}
```

```typescript
// packages/core/src/test-utils/helpers.ts
export async function expectToThrowAsync(
  fn: () => Promise<unknown>,
  errorMatch?: string | RegExp
) {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = true;
    if (errorMatch && e instanceof Error) {
      expect(e.message).toMatch(errorMatch);
    }
  }
  expect(threw).toBe(true);
}
```

### Lefthook Update (`lefthook.yml`)

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
    test:
      glob: "*.{ts,tsx}"
      run: bun test --bail
```

---

## Touchpoints

Files to create or modify:

### Root Level
- `bunfig.toml` - Add test configuration (MODIFY)
- `package.json` - Add test scripts (MODIFY)
- `lefthook.yml` - Add test to pre-commit (MODIFY)

### Core Package
- `packages/core/src/test-utils/index.ts` - Test utilities (CREATE)
- `packages/core/src/test-utils/mocks.ts` - Mock factories (CREATE)
- `packages/core/src/test-utils/helpers.ts` - Helper functions (CREATE)
- `packages/core/src/example.test.ts` - Example test (CREATE)

### Each Package
- `packages/*/package.json` - Add test script (MODIFY)

---

## Dependencies

- ✅ PRD-001: Bun Monorepo Setup
- ✅ PRD-002: Code Quality Infrastructure
- No external dependencies - Bun has built-in testing

---

## Success Metrics

- `bun test` discovers and runs all tests
- `bun test --coverage` produces coverage report
- Coverage meets 70% threshold on example code
- Pre-commit hook includes test running
- Tests complete in reasonable time (< 30s for full suite)

---

## Implementation Notes

### Suggested Implementation Order

1. **Configure bunfig.toml** - Add test settings
2. **Add root scripts** - test, test:coverage, test:watch
3. **Create test utilities** - in packages/core
4. **Write example tests** - demonstrate patterns
5. **Add per-package scripts** - test scripts in each package
6. **Update Lefthook** - add test to pre-commit
7. **Verify coverage** - ensure threshold works

### Testing Conventions

Ralph should follow these testing patterns:

1. **File naming**: `*.test.ts` next to the file being tested
2. **Describe blocks**: One per function/class being tested
3. **Test naming**: Use descriptive names that explain the scenario
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Isolation**: No shared mutable state between tests
6. **Coverage**: Aim for 70%+ on all new code

### Validation Commands

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run in watch mode
bun test --watch

# Run specific package tests
bun test packages/core

# Run specific test file
bun test packages/core/src/example.test.ts
```

---

## Codebase Patterns

Ralph should follow these patterns for this PRD:

- Bun's test runner is Jest-compatible but uses `bun:test`
- Use `describe`, `test`, `expect` from `bun:test`
- Put test utilities in `packages/core/src/test-utils/`
- Export test utilities for use in other packages

---

