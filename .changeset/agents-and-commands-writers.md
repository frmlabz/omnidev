---
"@omnidev-ai/adapters": minor
"@omnidev-ai/core": minor
---

Add writers for subagents and commands to Claude Code and OpenCode

- Added `ClaudeAgentsWriter` that writes subagents to `.claude/agents/<name>.md`
- Added `ClaudeCommandsAsSkillsWriter` that transforms commands into skills at `.claude/skills/<name>/SKILL.md`
- Added `OpenCodeAgentsWriter` that writes subagents to `.opencode/agents/<name>.md` with OpenCode-specific format
- Added `OpenCodeCommandsWriter` that writes commands to `.opencode/commands/<name>.md`
- Extended `Subagent` type with OpenCode-specific fields: `mode`, `temperature`, `maxSteps`, `hidden`, `toolPermissions`, `permissions`, `modelId`
- Extended `Command` type with OpenCode-specific fields: `agent`, `modelId`
- Automatic model mapping from Claude (sonnet/opus/haiku) to OpenCode format (anthropic/claude-*)
- Automatic permission mode mapping from Claude to OpenCode format
