# @omnidev-ai/adapters

## 0.2.1

### Patch Changes

- Updated dependencies [d2b0f36]
- Updated dependencies [3014846]
  - @omnidev-ai/core@0.13.1

## 0.2.0

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

- 7508fb5: Add MCP support for Codex via CodexTomlWriter

  - Added `CodexTomlWriter` that writes MCP server configurations to `.codex/config.toml`
  - Supports stdio transport (command, args, env, cwd) and http transport (url, http_headers)
  - Skips SSE transport with a warning (not supported by Codex)
  - OmniDev fully manages the config file and regenerates it on each sync

- a3ed7e2: Use native `.cursor/` directory structure for Cursor provider

  - Skills now written to `.cursor/skills/` instead of `.claude/skills/`
  - All Cursor content uses `.cursor/` directory: skills, agents, commands, rules

### Patch Changes

- 2f0e614: Minor fixes preparing for launch
- c31994f: Reorganize writers into provider-specific folders (generic, claude, codex, cursor, opencode)
- c98c316: Change how internally packages are imported, move away from relative imports with `.js` extension to node subpath imports
- Updated dependencies [fe94ed9]
- Updated dependencies [0cccb98]
- Updated dependencies [75e667c]
- Updated dependencies [7c43c20]
- Updated dependencies [2f0e614]
- Updated dependencies [095dce8]
- Updated dependencies [c98c316]
  - @omnidev-ai/core@0.13.0

## 0.1.2

### Patch Changes

- Updated dependencies [dc3510e]
  - @omnidev-ai/core@0.12.0

## 0.1.1

### Patch Changes

- @omnidev-ai/core@0.11.1

## 0.1.0

### Minor Changes

- 2085dbb: Add [general] section to omni.toml configuration for project, active_profile, and always_enabled_capabilities settings. This prevents TOML parsing issues where root-level keys placed after section headers were incorrectly parsed as belonging to those sections.

### Patch Changes

- Updated dependencies [2085dbb]
  - @omnidev-ai/core@0.11.0

## 0.0.14

### Patch Changes

- @omnidev-ai/core@0.10.1

## 0.0.13

### Patch Changes

- Updated dependencies [bc8d7d2]
  - @omnidev-ai/core@0.10.0

## 0.0.12

### Patch Changes

- Updated dependencies [fc14779]
  - @omnidev-ai/core@0.9.0

## 0.0.11

### Patch Changes

- Updated dependencies [233883a]
- Updated dependencies [abcde4f]
  - @omnidev-ai/core@0.8.0

## 0.0.10

### Patch Changes

- Updated dependencies [969afb4]
  - @omnidev-ai/core@0.7.0

## 0.0.9

### Patch Changes

- 23fc106: Trying to fix incorrect tarbal versions
- Updated dependencies [23fc106]
  - @omnidev-ai/core@0.6.2

## 0.0.8

### Patch Changes

- @omnidev-ai/core@0.6.1

## 0.0.7

### Patch Changes

- @omnidev-ai/core@0.6.0

## 0.0.6

### Patch Changes

- @omnidev-ai/core@0.5.4

## 0.0.5

### Patch Changes

- @omnidev-ai/core@0.5.3

## 0.0.4

### Patch Changes

- @omnidev-ai/core@0.5.2

## 0.0.3

### Patch Changes

- @omnidev-ai/core@0.5.1

## 0.0.2

### Patch Changes

- Updated dependencies [cf84ef0]
  - @omnidev-ai/core@0.5.0

## 0.0.1

### Patch Changes

- Updated dependencies [ddc5ba8]
  - @omnidev-ai/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [756f41c]
  - @omnidev-ai/core@0.3.0
