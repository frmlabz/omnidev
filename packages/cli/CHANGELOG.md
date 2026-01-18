# @omnidev-ai/cli

## 0.6.1

### Patch Changes

- 6fd6ac4: Testing bun runtime removal
  - @omnidev-ai/core@0.6.1

## 0.6.0

### Minor Changes

- 492e780: Remove bun dependency in runtime

### Patch Changes

- @omnidev-ai/core@0.6.0

## 0.5.4

### Patch Changes

- b6e8bd0: Remove Bun dependency totally
  - @omnidev-ai/core@0.5.4

## 0.5.3

### Patch Changes

- 498bc84: Added integration tests with Docker, and fixed Bun dependency
  - @omnidev-ai/core@0.5.3

## 0.5.2

### Patch Changes

- eadf41b: Try and fix again
  - @omnidev-ai/core@0.5.2

## 0.5.1

### Patch Changes

- 1f2bbce: fix noExternal in cli package
  - @omnidev-ai/core@0.5.1

## 0.5.0

### Minor Changes

- cf84ef0: Improve publishing setup

### Patch Changes

- Updated dependencies [cf84ef0]
  - @omnidev-ai/core@0.5.0

## 0.4.0

### Minor Changes

- ddc5ba8: Remove dependency on bun after publishing, transpile with `tsdown` beforehand. Make `adapters` package private

### Patch Changes

- Updated dependencies [ddc5ba8]
  - @omnidev-ai/core@0.4.0
  - @omnidev-ai/adapters@0.0.1

## 0.3.0

### Minor Changes

- 756f41c: ## New Features

  - **Provider Adapters**: New provider system with built-in support for Claude Code, Cursor, OpenCode, and Codex. Use `omnidev provider` to manage providers and `omnidev init` now includes interactive provider selection.

  - **Direct MCP Configuration**: Define MCP servers directly in `omni.toml` without wrapping capabilities. Configure servers inline with environment variables and arguments.

  - **Improved Init Command**: Enhanced `omnidev init` with better instructions, provider detection, and interactive setup flow.

  - **Comprehensive Examples**: Added example configurations demonstrating basic setup, GitHub sources, MCP configuration, profiles, and local development workflows.

  ## Changes

  - **Simplified Architecture**: Removed the internal MCP sandbox package in favor of direct MCP configuration, resulting in a leaner dependency tree.

  - **Removed Automatic Gitignore Management**: The gitignore manager has been removed. Projects should manage their own `.gitignore` entries for the `.omni/` directory.

  - **Removed Symlink-based Capability Loading**: Capabilities are now loaded directly without symlink creation, simplifying the sync process.

  ## Internal

  - Improved test organization and coverage
  - Better test utilities with standardized setup patterns
  - Example testing infrastructure for validating configuration files

### Patch Changes

- Updated dependencies [756f41c]
  - @omnidev-ai/core@0.3.0
  - @omnidev-ai/adapters@0.3.0

## 0.1.1

### Patch Changes

- bdc8895: Fix workspace protocol in published packages by converting workspace:\* to real versions during publish
- Updated dependencies [bdc8895]
  - @omnidev-ai/core@0.1.1
