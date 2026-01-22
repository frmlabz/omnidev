# @omnidev-ai/cli

## 0.13.1

### Patch Changes

- 0da8558: Redeploy
  - @omnidev-ai/capability@0.13.1

## 0.13.0

### Minor Changes

- 0c88759: Fixes
- 4a72cc4: Changing how packages work
- cb602ea: Improve capability versioning system

  - Rename `ref` to `version` in capability source configs for clearer semantics
  - Rename `ref` to `pinned_version` in lock file entries
  - Add `--pin` flag to `omnidev add cap` for automatic version detection
  - Add version mismatch warnings during sync
  - Add `--verbose` flag to `capability list` to check for updates
  - Add integrity verification for capability sources
  - Git sources now always include `version` field (defaults to "latest")
  - File sources remain simple strings (no version field)

  **Breaking Change:** Old configs using `ref` must be updated to use `version`. Run `omnidev sync` to regenerate lock files.

### Patch Changes

- Updated dependencies [0c88759]
- Updated dependencies [4a72cc4]
  - @omnidev-ai/capability@0.13.0

## 0.12.0

### Minor Changes

- dc3510e: Add security scanning and capability versioning

  - Add supply-chain security scanning for capabilities (unicode attacks, symlink escapes, suspicious scripts)
  - Add `omnidev security issues` command to scan for security issues
  - Add `omnidev security allow/deny` commands to manage allowed findings
  - Add capability versioning with content hashing and git commit tracking
  - Add `--programmatic` flag to `capability new` for TypeScript capabilities with CLI commands
  - Fix capability ID inference from `--path` for GitHub sources

### Patch Changes

- 1faeefa: Move to nodejs instead of bun for loaders
- 3fed11d: Fix overly catching security checker
- Updated dependencies [dc3510e]
  - @omnidev-ai/core@0.12.0

## 0.11.1

### Patch Changes

- e13e0a1: Fix version check
  - @omnidev-ai/core@0.11.1

## 0.11.0

### Minor Changes

- 2085dbb: Add [general] section to omni.toml configuration for project, active_profile, and always_enabled_capabilities settings. This prevents TOML parsing issues where root-level keys placed after section headers were incorrectly parsed as belonging to those sections.

### Patch Changes

- b1939ea: Cleanup of omni.toml
- Updated dependencies [2085dbb]
  - @omnidev-ai/core@0.11.0

## 0.10.1

### Patch Changes

- 0e0e4c5: Remove .env support
  - @omnidev-ai/core@0.10.1

## 0.10.0

### Minor Changes

- bc8d7d2: Add local capability support and capability creation command

  - Add support for `file://` sources to load capabilities from local directories
  - Add `capability new` command to scaffold new capabilities with interactive prompts
  - Refactor adapter system with dedicated writers for hooks, skills, rules, and instructions

### Patch Changes

- Updated dependencies [bc8d7d2]
  - @omnidev-ai/core@0.10.0

## 0.9.0

### Minor Changes

- 66cfd80: Add capability groups and support for hooks

### Patch Changes

- fc14779: Add support for folder renaming when wrapping
- Updated dependencies [fc14779]
  - @omnidev-ai/core@0.9.0

## 0.8.0

### Minor Changes

- abcde4f: Added OMNI.md support

### Patch Changes

- 233883a: Better integration tests
- Updated dependencies [233883a]
- Updated dependencies [abcde4f]
  - @omnidev-ai/core@0.8.0

## 0.7.0

### Minor Changes

- 969afb4: Add `omnidev add cap` and `omnidev add mcp` commands for easily adding capabilities and MCP servers to omni.toml

  - `omnidev add cap <name> --github <user/repo> [--path <path>]` - Add a capability source from GitHub
  - `omnidev add mcp <name> --transport http --url <url>` - Add an HTTP/SSE MCP server
  - `omnidev add mcp <name> --command <cmd> --args "<args>"` - Add a stdio MCP server

  Also fixes `capability enable/disable` commands to properly preserve existing omni.toml content (sources, mcps, always_enabled_capabilities) instead of overwriting with commented examples.

### Patch Changes

- Updated dependencies [969afb4]
  - @omnidev-ai/core@0.7.0

## 0.6.2

### Patch Changes

- 23fc106: Trying to fix incorrect tarbal versions
- Updated dependencies [23fc106]
  - @omnidev-ai/core@0.6.2

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
