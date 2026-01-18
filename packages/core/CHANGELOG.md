# @omnidev-ai/core

## 0.6.2

### Patch Changes

- 23fc106: Trying to fix incorrect tarbal versions

## 0.6.1

## 0.6.0

## 0.5.4

## 0.5.3

## 0.5.2

## 0.5.1

## 0.5.0

### Minor Changes

- cf84ef0: Improve publishing setup

## 0.4.0

### Minor Changes

- ddc5ba8: Remove dependency on bun after publishing, transpile with `tsdown` beforehand. Make `adapters` package private

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

## 0.1.1

### Patch Changes

- bdc8895: Fix workspace protocol in published packages by converting workspace:\* to real versions during publish
