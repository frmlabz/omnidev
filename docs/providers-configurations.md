# Configuration Patterns for Agentic Coding Tools

:warning: Not sure how correct this is, I let `oh-my-opencode` sysyphus ultra work and search the web, there's too many configuration options spread out too wide so it's hard to follow if it's all there. If you see a mistake please submit a PR.

This document provides a comprehensive overview of configuration patterns, file locations, and setup for the most popular agentic coding tools: **Amp**, **OpenCode**, **Cursor**, **Claude Code**, and **Codex**.

---

## Table of Contents

- [Amp (Sourcegraph)](#amp-sourcegraph)
- [OpenCode](#opencode)
- [Cursor](#cursor)
- [Claude Code (Anthropic)](#claude-code-anthropic)
- [Codex (OpenAI)](#codex-openai)
- [Comparison Summary](#comparison-summary)

---

## Amp (Sourcegraph)

### Configuration File Locations

**User-Scoped Configuration:**
- `~/.config/amp/AGENTS.md` - Personal preferences, device-specific commands
- `~/.config/AGENTS.md` - Alternative global location
- `~/.config/amp/commands/` - Custom commands
- **Note:** Amp does NOT use a separate global skills directory

**Project-Scoped Configuration:**
- `AGENTS.md` in cwd, parent dirs, & subtrees - Architecture, build/test commands, project conventions
- Subtree `AGENTS.md` files - Included when agent reads files in that subtree
- `.agents/commands/` - Project-specific custom commands
- **`.agents/skills/`** - Project-specific agent skills (in workspace root)

**Global/System Configuration:**
- Remote server configuration (threads stored on ampcode.com servers)
- Thread sharing via web UI (cloud-based)

### Agent Configuration

**Primary Agents:**
- Main agent interacts directly with user
- Uses Claude Opus 4.5 by default (up to 200k tokens)
- 2 modes: `smart` (unconstrained) and `rush` (faster, cheaper)

**Subagents:**
- Spawning mechanism for complex, independent task execution
- Each subagent has own context window and tool access
- Can be invoked automatically or manually encouraged in prompts
- Cannot communicate with each other directly

### Tools & Features

**Built-in Tools:**
- `bash` - Shell command execution
- `read` - File reading
- `edit` - File editing
- `write` - File writing
- `oracle` - Second opinion model (GPT-5.2) for complex reasoning
- `librarian` - Search remote codebases (GitHub)
- `painter` - Image generation/editing (Gemini 3 Pro Image)

**MCP (Model Context Protocol) Support:**
- Configure in `amp.mcpServers` in settings file
- Local and remote MCP servers supported
- OAuth authentication for remote servers

### Permissions System

Configure permissions in settings via `amp.permissions`:
- `allow` - Allow without asking
- `ask` - Prompt user for approval
- `reject` - Block operation outright
- `delegate` - Delegate to external program

Example:
```json
"amp.permissions": [
  { "tool": "Bash", "matches": { "cmd": "*git commit*" }, "action": "ask" },
  { "tool": "mcp__playwright_*", "action": "allow" }
]
```

### Custom Commands

Located in:
- `.agents/commands/` in workspace
- `~/.config/amp/commands/`

Markdown files or executables create custom commands:
```bash
# Example: .agents/commands/code-review.md
```
Content inserted into prompt when invoked.

### Agent Skills

**Installation:**
```bash
amp skill add ampcode/amp-contrib
amp skill add owner/repo/skill-name
```

**Locations:**
- `.agents/skills/` in workspace
- `~/.config/agents/skills/` (user-level)
- `.claude/skills/` (Claude Code compatibility)

**Skill Format:**
```markdown
---
name: my-skill
description: What this skill does and when to use it
---

# Skill Instructions
Detailed instructions for the agent...
```

### Hooks

Amp uses MCP hooks and permission-based tool gating rather than explicit hooks.

### Documentation & Resources

- **Official Manual:** https://ampcode.com/manual
- **Installation:** https://ampcode.com/install
- **GitHub:** https://github.com/sourcegraph/amp
- **Subagents Blog:** https://ampcode.com/agents-for-the-agent
- **AGENTS.md Standard:** https://agents.md/

### Key Links

- Main site: https://ampcode.com
- Manual: https://ampcode.com/manual
- Documentation: https://ampcode.com/manual#configuration
- AGENTS.md guide: https://ampcode.com/manual#AGENTS.md
- MCP docs: https://ampcode.com/manual#mcp
- Permissions: https://ampcode.com/manual#permissions

---

## OpenCode

Uses AGENTS.md

### Configuration File Locations

**User-Scoped Configuration:**
- `~/.config/opencode/opencode.json` - Global user preferences (theme, providers, keybinds)
- `~/.config/opencode/agents/` - Custom agents (markdown files)
- `~/.config/opencode/commands/` - Custom commands
- `~/.config/opencode/modes/` - Agent modes
- `~/.config/opencode/plugins/` - Plugins
- `~/.config/opencode/skills/` - Agent skills
- `~/.config/opencode/tools/` - Custom tools
- `~/.config/opencode/themes/` - Custom themes

**Project-Scoped Configuration:**
- `opencode.json` in project root - Project-specific settings
- `.opencode/agents/` - Project agents
- `.opencode/commands/` - Project commands
- `.opencode/modes/` - Project modes
- `.opencode/plugins/` - Project plugins
- `.opencode/skills/` - Project skills
- `.opencode/tools/` - Project tools
- `.opencode/themes/` - Project themes

**Global/System Configuration:**
- `OPENCODE_CONFIG` env var - Custom config file path
- `OPENCODE_CONFIG_DIR` env var - Custom config directory
- Remote config from `.well-known/opencode` - Organizational defaults

**Precedence Order (highest to lowest):**
1. Remote config (`.well-known/opencode`)
2. Global config (`~/.config/opencode/opencode.json`)
3. Custom config (`OPENCODE_CONFIG` env var)
4. Project config (`opencode.json`)
5. `.opencode` directories
6. Inline config (`OPENCODE_CONFIG_CONTENT` env var)

**Note:** Configuration files are **merged**, not replaced. Later configs override conflicting keys only.

### Agent Configuration

**Primary Agents:**
- **Build** - Default agent with all tools enabled
- **Plan** - Restricted agent (file edits: ask, bash: ask)
- Switch between them with **Tab** key

**Subagents:**
- **General** - General-purpose for research and multi-step tasks
- **Explore** - Fast, read-only agent for codebase exploration
- Invoked automatically by description or manually via `@mention`

### Agent Configuration (JSON)

In `opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "code-reviewer": {
      "description": "Reviews code for best practices and potential issues",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "You are a code reviewer. Focus on security, performance, and maintainability.",
      "tools": {
        "write": false,
        "edit": false
      }
    },
    "build": {
      "mode": "primary",
      "model": "anthropic/claude-sonnet-4-5"
    }
  }
}
```

### Agent Configuration (Markdown)

Files in `~/.config/opencode/agents/` or `.opencode/agents/`:
```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
tools:
  write: false
  edit: false
  bash: false
---

You are a code reviewer. Focus on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance implications
- Security considerations
```

### Agent Options

**Required:**
- `description` - When to delegate to this agent

**Optional:**
- `mode` - `primary`, `subagent`, or `all` (default: `all`)
- `model` - Override model (e.g., `anthropic/claude-sonnet-4-5`)
- `temperature` - 0.0-1.0 (lower = deterministic, higher = creative)
- `maxSteps` - Maximum agentic iterations before forced response
- `tools` - Enable/disable specific tools
- `permission` - Override permissions
- `prompt` - Custom system prompt
- `hidden` - Hide from `@` autocomplete (subagents only)
- `permission.task` - Control which subagents can be invoked
- Any other options passed to provider

### Custom Commands

**In config:**
```json
{
  "command": {
    "test": {
      "template": "Run full test suite with coverage report.",
      "description": "Run tests with coverage",
      "agent": "build",
      "model": "anthropic/claude-haiku-4-5"
    }
  }
}
```

**In directories:**
- `~/.config/opencode/commands/` (markdown or executables)
- `.opencode/commands/` (project-specific)

### MCP Servers

**Configuration:**
```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless"]
    },
    "linear": {
      "type": "remote",
      "url": "https://mcp.linear.app/sse"
    }
  }
}
```

### Permissions

**Global:**
```json
{
  "permission": {
    "edit": "ask",
    "bash": "ask"
  }
}
```

**Per-agent:**
```json
{
  "agent": {
    "build": {
      "permission": {
        "bash": {
          "*": "ask",
          "git status *": "allow"
        }
      }
    }
  }
}
```

### Formatters

```json
{
  "formatter": {
    "prettier": {
      "disabled": true
    },
    "custom-prettier": {
      "command": ["npx", "prettier", "--write", "$FILE"],
      "extensions": [".js", ".ts", ".jsx", ".tsx"]
    }
  }
}
```

### Documentation & Resources

- **Official Docs:** https://opencode.ai/docs
- **GitHub:** https://github.com/anomalyco/opencode
- **Config Reference:** https://opencode.ai/docs/config/
- **Agents Guide:** https://opencode.ai/docs/agents/
- **MCP Servers:** https://opencode.ai/docs/mcp-servers/

### Key Links

- Main site: https://opencode.ai
- Documentation: https://opencode.ai/docs
- Configuration: https://opencode.ai/docs/config/
- Agents: https://opencode.ai/docs/agents/
- Tools: https://opencode.ai/docs/tools/
- Models: https://opencode.ai/docs/models/
- GitHub: https://github.com/anomalyco/opencode

---

## Cursor

### Configuration File Locations

**User-Scoped Configuration:**
- Cursor Settings UI (in-app configuration)
- Platform-specific user config locations:
  - **macOS:** `~/Library/Application Support/Cursor/User/`
  - **Windows:** `%APPDATA%/Cursor/User/`
  - **Linux:** `~/.config/Cursor/User/`

**Project-Scoped Configuration:**
- `.cursorrules` - Project-specific rules for AI behavior
- `.cursor/` directory - Custom rules, agents, configurations
- `.cursor/rules/*.md` - Modular rule files

**Global Configuration:**
- Cursor Cloud (account-based sync across devices)
- Workspace settings (managed via UI)

### Cursor Rules (`.cursorrules`)

The `.cursorrules` file is a markdown file that defines AI behavior patterns and best practices for the project.

**Example:**
```markdown
# Project-Specific Cursor Rules

When writing code:
- Use TypeScript strict mode
- Follow functional programming patterns
- Single quotes, no semicolons
- Write descriptive variable names

When making changes:
- Always run tests before committing
- Use `bun test` for running tests
- Check for linting errors with `bun run lint`

Avoid:
- `any` types
- Commented-out code
- Console.log in production
```

**Community Collections:**
- https://github.com/PatrickJS/awesome-cursorrules - Curated collection of `.cursorrules` files
- https://github.com/JhonMA82/awesome-clinerules - Alternative collection

### Subagents

Cursor supports agent-based workflows, but documentation is limited due to platform errors.

**Configuration:**
- Likely via `.cursor/agents/` directory
- Agent definitions in markdown or JSON format
- Custom prompts and tool restrictions

### Custom Rules (Modular)

Place rules in `.cursor/rules/*.md` for modular organization:
```markdown
# TypeScript Rules

- Always use interfaces for object shapes
- Prefer `const` over `let` when possible
- Use explicit return types for public functions
```

### Commands

Cursor supports slash commands, configured via:
- `.cursor/commands/` directory
- Custom commands for repetitive tasks

### Hooks

Limited information available due to platform documentation issues.

### Documentation & Resources

- **Official Site:** https://cursor.com
- **Rules Guide:** https://cursor.com/docs/context/rules (currently experiencing errors)
- **Community:** https://forum.cursor.com
- **Blog:** https://cursor.com/blog/agent-best-practices

### Key Links

- Main site: https://cursor.com
- Rules docs: https://cursor.com/docs/context/rules
- Subagents: https://cursor.com/docs/context/subagents (currently experiencing errors)
- Community: https://forum.cursor.com
- awesome-cursorrules: https://github.com/PatrickJS/awesome-cursorrules

---

## Claude Code (Anthropic)

### Configuration File Locations

**User-Scoped Configuration:**
- `~/.claude/settings.json` - User settings
- `~/.claude/agents/` - Custom subagents (markdown files)
- `~/.claude/skills/` - Agent skills
- `~/.claude/hooks/` - Hook scripts (optional location)

**Project-Scoped Configuration:**
- `.claude/settings.json` - Project settings
- `.claude/settings.local.json` - Local project settings (not committed)
- `.claude/agents/` - Project subagents
- `.claude/skills/` - Project skills
- Enterprise managed policy settings

**Global/System Configuration:**
- CLI flags for session-specific settings
- Cloud provider integration (optional)
- Environment variables

### Subagents

**Built-in Subagents:**
- **Explore** - Fast, read-only for codebase exploration (Haiku)
- **Plan** - Research agent for planning (read-only)
- **General-purpose** - Multi-step tasks with full tool access
- Additional: `Bash`, `statusline-setup`, `Claude Code Guide`

**Subagent Configuration (Markdown):**

Location: `~/.claude/agents/` or `.claude/agents/`

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep, Bash
model: sonnet
---

You are a code reviewer. When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
```

**Frontmatter Fields:**
- `name` (required) - Unique identifier
- `description` (required) - When Claude should delegate
- `tools` - Tools subagent can use (inherits all if omitted)
- `disallowedTools` - Tools to deny
- `model` - `sonnet`, `opus`, `haiku`, or `inherit`
- `permissionMode` - `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan`
- `skills` - Skills to load into context
- `hooks` - Lifecycle hooks for this subagent

**Subagent Scope Priority:**
1. `--agents` CLI flag (current session)
2. `.claude/agents/` (current project)
3. `~/.claude/agents/` (all projects)
4. Plugin's `agents/` directory (when plugin enabled)

**Usage:**
- Automatic delegation based on description
- Manual invocation: `Use @code-reviewer to review changes`
- Foreground (blocking) or background (concurrent)

### Hooks

**Configuration Locations:**
- `~/.claude/settings.json` - User hooks
- `.claude/settings.json` - Project hooks
- `.claude/settings.local.json` - Local hooks (not committed)

**Hook Events:**
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool completes
- `Notification` - When notifications sent
- `UserPromptSubmit` - Before user prompt processed
- `Stop` - When main agent finishes
- `SubagentStop` - When subagent finishes
- `PreCompact` - Before context compaction
- `SessionStart` - When session starts or resumes
- `SessionEnd` - When session ends

**Hook Configuration:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/validate-command.sh $TOOL_INPUT",
            "timeout": 30
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/run-linter.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/load-context.sh"
          }
        ]
      }
    ]
  }
}
```

**Hook Input (JSON via stdin):**
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/project/path",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

**Hook Output:**
- Exit code 0: Success
- Exit code 2: Blocking error
- JSON output for advanced control:
  ```json
  {
    "continue": true,
    "stopReason": "optional message",
    "suppressOutput": true,
    "systemMessage": "optional warning",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "reason text"
  }
  ```

### MCP (Model Context Protocol)

**Configuration in `settings.json`:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "brave-search": {
      "url": "https://search.brave.com/mcp",
      "headers": {
        "Authorization": "Bearer ${BRAVE_API_KEY}"
      }
    }
  }
}
```

### Skills

**Location:** `~/.claude/skills/` or `.claude/skills/`

**Skill Format:**
```markdown
---
name: playwright
description: MUST USE for any browser-related tasks
---

You are a browser automation specialist using Playwright MCP.
Always use the @playwright tool for:
- Browser verification
- Web scraping
- Screenshots
- Testing

Never use bash commands for browser operations.
```

### Permissions

**In `settings.json`:**
```json
{
  "permissions": {
    "deny": ["Task(Explore)", "Bash"],
    "allow": ["Read", "Grep"]
  }
}
```

### Environment Variables

- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` - Disable background tasks (set to `1`)
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` - Auto-compaction threshold
- `CLAUDE_PROJECT_DIR` - Available in hook commands

### Documentation & Resources

- **Official Docs:** https://code.claude.com/docs/en/overview
- **Subagents Guide:** https://code.claude.com/docs/en/sub-agents
- **Hooks Guide:** https://code.claude.com/docs/en/hooks-guide
- **MCP Integration:** https://code.claude.com/docs/en/mcp
- **Skills:** https://code.claude.com/docs/en/skills

### Key Links

- Main site: https://code.claude.com
- Documentation: https://code.claude.com/docs
- Subagents: https://code.claude.com/docs/en/sub-agents
- Hooks: https://code.claude.com/docs/en/hooks-guide
- MCP: https://code.claude.com/docs/en/mcp
- Skills: https://code.claude.com/docs/en/skills
- GitHub awesome list: https://github.com/VoltAgent/awesome-claude-code-subagents

---

## Codex (OpenAI)

### Configuration File Locations

**User-Scoped Configuration:**
- Configuration files in user home directory (platform-dependent)
- `~/.codex/` or equivalent location
- Profile-specific configurations

**Project-Scoped Configuration:**
- `.codex.json` in project root (optional)
- `.codex/` directory for project config

**Global/System Configuration:**
- Cloud-based configuration (managed via OpenAI dashboard)
- Environment variables for API keys
- CLI flags for session settings

### Configuration File

**Sample `codex.json`:**
```json
{
  "model": "gpt-5.1-codex",
  "permissions": {
    "edit": "ask",
    "bash": "ask"
  },
  "tools": {
    "webfetch": true,
    "websearch": true
  },
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  }
}
```

### Agents & Subagents

**Important:** Codex CLI does **NOT** support subagents. The Agents SDK is only for OpenAI API, not CLI tool.

If you need subagents, consider:
- Using OpenAI Agents SDK directly in your code
- Using Claude Code, Amp, or OpenCode which have native subagent support

**Agents SDK (API only, NOT CLI):**
- https://developers.openai.com/codex/guides/agents-sdk/
- Tools: https://openai.github.io/openai-agents-python/tools/

### Tools

**Hosted OpenAI Tools:**
- `WebSearchTool` - Web search
- `FileSearchTool` - Vector store search
- `CodeInterpreterTool` - Sandboxed code execution
- `HostedMCPTools` - MCP integrations

**Local Runtime Tools:**
- Computer use, shell, apply patch

**Function Calling:**
- Wrap any Python function as a tool

**Agents as Tools:**
- Expose an agent as callable tool without full handoff

### MCP Support

**Configuration:**
```json
{
  "mcpServers": {
    "playwright": {
      "url": "https://mcp.example.com/playwright",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

### Permissions

**Configuration:**
```json
{
  "permissions": {
    "edit": "ask",
    "bash": "allow",
    "webfetch": "deny"
  }
}
```

### Environment Variables

- `OPENAI_API_KEY` - API key for authentication
- Additional provider-specific variables

### Documentation & Resources

- **Official Docs:** https://developers.openai.com/codex/
- **Config Reference:** https://developers.openai.com/codex/config-reference/
- **Basic Config:** https://developers.openai.com/codex/config-basic/
- **Advanced Config:** https://developers.openai.com/codex/config-advanced/
- **Sample Config:** https://developers.openai.com/codex/config-sample/
- **Agents SDK:** https://developers.openai.com/codex/guides/agents-sdk/
- **GitHub:** https://github.com/openai/codex

### Key Links

- Main site: https://codex.openai.com
- Documentation: https://developers.openai.com/codex/
- Config reference: https://developers.openai.com/codex/config-reference/
- GitHub: https://github.com/openai/codex
- GitHub config docs: https://github.com/openai/codex/blob/main/docs/config.md

---

## Comparison Summary

| Feature | Amp | OpenCode | Cursor | Claude Code | Codex |
|---------|-----|----------|--------|-------------|-------|
| **Config File** | AGENTS.md | opencode.json | .cursorrules | settings.json | codex.json |
| **Format** | Markdown | JSON/JSONC | Markdown | JSON/Markdown | JSON |
| **User Config** | `~/.config/amp/` | `~/.config/opencode/` | UI + platform dir | `~/.claude/` | `~/.codex/` |
| **Project Config** | `AGENTS.md`, `.agents/` | `opencode.json`, `.opencode/` | `.cursorrules`, `.cursor/` | `.claude/` | `.codex.json`, `.codex/` |
| **Subagents** | ✓ (via Task tool) | ✓ (markdown/JSON) | ✓ (limited docs) | ✓ (markdown) | ✗ (SDK only, not CLI) |
| **Primary Agents** | 1 main (smart/rush) | Build, Plan | Unknown | Built-in | Agents SDK |
| **MCP Support** | ✓ | ✓ | Unknown | ✓ | ✓ |
| **Hooks** | MCP hooks | Hooks feature | Unknown | Extensive hooks | Unknown |
| **Skills** | ✓ (SKILL.md) | ✓ | Unknown | ✓ | Unknown |
| **Custom Commands** | ✓ | ✓ | ✓ | Slash commands | CLI commands |
| **Permissions** | ✓ | ✓ | Unknown | ✓ | ✓ |
| **Cloud Integration** | ✓ (ampcode.com) | Optional | ✓ | Optional | ✓ |
| **Documentation** | https://ampcode.com/manual | https://opencode.ai/docs | https://cursor.com/docs | https://code.claude.com/docs | https://developers.openai.com/codex/ |
| **GitHub** | sourcegraph/amp | anomalyco/opencode | (proprietary) | (proprietary) | openai/codex |

### Key Differences

**Amp:**
- Cloud-first with thread sharing
- AGENTS.md as simple, universal format
- Built-in Oracle (GPT-5.2) and Librarian subagents
- MCP with OAuth support
- Permission system with delegation

**OpenCode:**
- Purely open-source
- JSONC config with schema validation
- Config merging (not replacement)
- Built-in Build/Plan primary agents
- Extensive agent customization options

**Cursor:**
- Proprietary, closed-source
- .cursorrules markdown file
- Limited documentation due to platform errors
- Cloud-based configuration sync
- Strong community rules collections

**Claude Code:**
- Most comprehensive hooks system
- Subagents with multiple models (Haiku, Sonnet, Opus)
- Skills as standardized format
- Enterprise policy management
- Strong MCP integration

**Codex:**
- Cloud-based (OpenAI)
- CLI does NOT support subagents (Agents SDK is for API only)
- Hosted tools (WebSearch, FileSearch, CodeInterpreter)
- Configuration via JSON files
- Integration with OpenAI ecosystem

---

## Additional Resources

### Cross-Tool Standards

**AGENTS.md** - Universal format for guiding coding agents:
- https://agents.md/ - Official site
- https://github.com/agentmd/agent.md - GitHub repo

### Community Collections

- **Cursor:** https://github.com/PatrickJS/awesome-cursorrules
- **Claude Code:** https://github.com/VoltAgent/awesome-claude-code-subagents
- **Claude Code:** https://github.com/lst97/claude-code-sub-agents
- **Claude Code:** https://github.com/0xfurai/claude-code-subagents
- **Codex Subagents:** https://github.com/leonardsellem/codex-subagents-mcp

### Learning Resources

- **How to write great Cursor Rules:** https://trigger.dev/blog/cursor-rules
- **Writing OpenCode Agent Skills:** https://jpcaparas.medium.com/writing-opencode-agent-skills
- **What is AGENTS.md?:** https://cobusgreyling.medium.com/what-is-agents-md-2846b586b116

---

**Last Updated:** January 19, 2026

This document is maintained as a reference guide for developers working with agentic coding tools. Contributions and corrections are welcome!
