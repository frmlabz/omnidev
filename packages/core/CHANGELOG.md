# @omnidev-ai/core

## 0.13.1

### Patch Changes

- d2b0f36: Fix sync failing when local and remote capability branches have diverged

  Replaces `git pull --ff-only` with `git reset --hard` when fetching capability sources, ensuring the sync always matches the remote state regardless of local changes or divergent history.

- 3014846: Fix TOML parsing error when capability README contains HTML with double quotes

  Adds `escapeTomlString` helper to properly escape special characters (backslashes, double quotes, newlines, tabs) when generating capability.toml files from wrapped repositories.

## 0.13.0

### Minor Changes

- fe94ed9: Add writers for subagents and commands to Claude Code, Cursor, and OpenCode

  **Claude Code:**

  - `ClaudeAgentsWriter`: writes subagents to `.claude/agents/<name>.md`
  - `ClaudeCommandsAsSkillsWriter`: transforms commands into skills at `.claude/skills/<name>/SKILL.md`

  **Cursor:**

  - `CursorAgentsWriter`: writes subagents to `.cursor/agents/<name>.md` with YAML frontmatter (name, description, model, readonly)
  - `CursorCommandsWriter`: writes commands to `.cursor/commands/<name>.md` as plain Markdown

  **OpenCode:**

  - `OpenCodeAgentsWriter`: writes subagents to `.opencode/agents/<name>.md` with OpenCode-specific format
  - `OpenCodeCommandsWriter`: writes commands to `.opencode/commands/<name>.md`

  **Type Extensions:**

  - Extended `Subagent` type with OpenCode-specific fields: `mode`, `temperature`, `maxSteps`, `hidden`, `toolPermissions`, `permissions`, `modelId`
  - Extended `Command` type with OpenCode-specific fields: `agent`, `modelId`

  **Automatic Mappings:**

  - Model mapping: Claude (sonnet/opus/haiku) → OpenCode (anthropic/claude-\*), Cursor (fast/inherit)
  - Permission mode mapping: Claude → OpenCode permissions object, Cursor readonly flag

- 0cccb98: Add `always_disabled` support and improved `omni.local.toml` merging

  - Added `always_disabled` option to `[capabilities]` section that removes capabilities from ALL profiles
  - Supports group references in `always_disabled` (e.g., `group:noisy-tools`)
  - Improved config merging for `omni.local.toml`:
    - Capability sources and groups are now properly deep-merged
    - `always_enabled` and `always_disabled` are combined from both configs
  - Updated documentation with detailed merge behavior and examples

- 7c43c20: Add hooks.json support for Claude plugin wrapping

  - Support loading hooks from `hooks.json` (Claude plugin format) in addition to `hooks.toml`
  - Check for hooks in: `hooks/hooks.toml` (priority), `hooks/hooks.json`, and `hooks.json` (root)
  - Resolve `${CLAUDE_PLUGIN_ROOT}` and `${OMNIDEV_CAPABILITY_ROOT}` to absolute paths during loading
  - Add `resolveCapabilityRoot` option to hook loading
  - Update CLI help text to mention Claude plugin auto-wrapping
  - Add integration test for Claude plugin wrapping flow

### Patch Changes

- 75e667c: Always rebuild capabilities with build scripts during sync

  Sync now always rebuilds capabilities that have a build script in their package.json, ensuring the latest TypeScript changes are compiled even when dist/index.js already exists.

- 2f0e614: Minor fixes preparing for launch
- 095dce8: Validate GitHub repository before adding to omni.toml

  The `add cap` command now validates that a GitHub repository exists and is a valid capability before writing to omni.toml. This prevents adding invalid or non-existent repositories to the configuration.

  Validation checks:

  - Repository exists and is accessible
  - Repository contains capability.toml OR can be auto-wrapped (has skills, agents, commands, rules, docs, or .claude-plugin)

  If validation fails, the command exits with an appropriate error message without modifying omni.toml.

- c98c316: Change how internally packages are imported, move away from relative imports with `.js` extension to node subpath imports

## 0.12.0

### Minor Changes

- dc3510e: Add security scanning and capability versioning

  - Add supply-chain security scanning for capabilities (unicode attacks, symlink escapes, suspicious scripts)
  - Add `omnidev security issues` command to scan for security issues
  - Add `omnidev security allow/deny` commands to manage allowed findings
  - Add capability versioning with content hashing and git commit tracking
  - Add `--programmatic` flag to `capability new` for TypeScript capabilities with CLI commands
  - Fix capability ID inference from `--path` for GitHub sources

## 0.11.1

## 0.11.0

### Minor Changes

- 2085dbb: Add [general] section to omni.toml configuration for project, active_profile, and always_enabled_capabilities settings. This prevents TOML parsing issues where root-level keys placed after section headers were incorrectly parsed as belonging to those sections.

## 0.10.1

## 0.10.0

### Minor Changes

- bc8d7d2: Add local capability support and capability creation command

  - Add support for `file://` sources to load capabilities from local directories
  - Add `capability new` command to scaffold new capabilities with interactive prompts
  - Refactor adapter system with dedicated writers for hooks, skills, rules, and instructions

## 0.9.0

### Patch Changes

- fc14779: Add support for folder renaming when wrapping

## 0.8.0

### Minor Changes

- abcde4f: Added OMNI.md support

### Patch Changes

- 233883a: Better integration tests

## 0.7.0

### Minor Changes

- 969afb4: Add `omnidev add cap` and `omnidev add mcp` commands for easily adding capabilities and MCP servers to omni.toml

  - `omnidev add cap <name> --github <user/repo> [--path <path>]` - Add a capability source from GitHub
  - `omnidev add mcp <name> --transport http --url <url>` - Add an HTTP/SSE MCP server
  - `omnidev add mcp <name> --command <cmd> --args "<args>"` - Add a stdio MCP server

  Also fixes `capability enable/disable` commands to properly preserve existing omni.toml content (sources, mcps, always_enabled_capabilities) instead of overwriting with commented examples.

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
