---
name: testing-guide
description: Concise testing patterns for OmniDev.
---

# Testing Guide

## Required patterns
- Use `@omnidev-ai/core/test-utils` for shared helpers.
- Use `setupTestDir(prefix, { chdir: true, createOmniDir? })` for temp dirs + cleanup.
- Use `testDir.path` for filesystem operations.
- Use `testDir.reset("prefix-")` when you need a fresh workspace mid-test.
- Avoid manual `process.chdir` and `rmSync` when the helper can handle it.
- Use `beforeEach`/`afterEach` only for test-specific setup (mocks, fixtures).

## Determinism
- Sort `readdir`/`readdirSync` results before indexing or comparing order:
  - `entries.sort((a, b) => a.name.localeCompare(b.name))`

## CLI tests
- Mock `process.exit`, assert the code, restore in `afterEach`.
- Prefer `captureConsole()` for stdout/stderr assertions.

## Common test-utils
- `expectToThrowAsync()` for async error tests.
- `createSpy()` / `createMockFn()` for call tracking or sequential returns.
- `waitForCondition()` for polling.

## Minimal example

```ts
import { setupTestDir } from "@omnidev-ai/core/test-utils";

describe("example", () => {
  const testDir = setupTestDir("example-test-", { chdir: true, createOmniDir: true });

  test("writes config", async () => {
    await Bun.write("omni.toml", "project = \"test\"");
    expect(await Bun.file("omni.toml").text()).toContain("project");
    expect(testDir.path).toContain("example-test-");
  });
});
```
