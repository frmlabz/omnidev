---
title: Hooks
description: Automate Claude Code and Codex hooks from a shared capability file.
sidebar:
  order: 1
---

Hooks let capabilities register automated scripts that run at specific points in the agent lifecycle. When you run [`omnidev sync`](/commands/core/#omnidev-sync), OmniDev reads `hooks/hooks.toml`, composes a provider-specific view, and writes the appropriate output files for each enabled provider.

This enables powerful automation: validating commands before execution, running linters after file edits, injecting context at session start, and more.

:::note
OmniDev supports a shared hook source format plus optional `[claude]` and `[codex]` sections for provider-specific overrides. For the full native specifications, see the [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks) and the [Codex Hooks Documentation](https://developers.openai.com/codex/hooks).
:::

## Quick Start

Create a `hooks/hooks.toml` file in your capability:

```toml
# Validate bash commands before execution
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/validate-bash.sh"
timeout = 30
```

Then add your validation script at `hooks/validate-bash.sh`:

```bash
#!/bin/bash
# Read JSON input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Block dangerous patterns
if echo "$COMMAND" | grep -qE 'rm -rf /|dd if='; then
  echo "Dangerous command blocked" >&2
  exit 2  # Exit code 2 blocks the tool
fi

exit 0  # Allow the command
```

Make it executable:

```bash
chmod +x hooks/validate-bash.sh
```

## Capability Structure

Place hooks configuration and scripts in the `hooks/` directory:

```
my-capability/
├── omni.toml
├── hooks/
│   ├── hooks.toml           # Hook configuration
│   ├── validate-bash.sh     # PreToolUse script
│   └── run-linter.sh        # PostToolUse script
└── ...
```

## Configuration Format

Hooks are defined in TOML with a shared top-level section plus optional provider-specific sections:

```toml
# hooks/hooks.toml

# Shared hooks
[[PreToolUse]]
matcher = "Bash"           # Regex pattern for tool names
[[PreToolUse.hooks]]       # Array of hooks to run
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/validate-bash.sh"
timeout = 30               # Optional, in seconds

# Provider-specific override for Codex only
[[codex.PreToolUse]]
matcher = "Bash"
[[codex.PreToolUse.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/validate-bash.sh"
statusMessage = "Checking Bash command"
```

Provider composition rules:

- Top-level events are shared.
- `[claude]` and `[codex]` are optional provider-specific escape hatches.
- If a provider section defines an event, that event replaces the shared event for that provider only.
- Hooks that are not usable in the active provider are skipped with warnings instead of failing sync.

## Provider Compatibility

| Provider | Output files | Notes |
|----------|--------------|-------|
| Claude Code | `.claude/settings.json` | Shared hooks plus `[claude]` overrides |
| Codex | `.codex/hooks.json`, `.codex/config.toml` | Shared hooks plus `[codex]` overrides; `features.codex_hooks = true` is written automatically |

### Shared hooks

Top-level hooks should be the portable/common subset you want available on both providers.

### Provider-specific hooks

Use provider sections when a hook only makes sense on one provider:

```toml
[[claude.PermissionRequest]]
matcher = "Bash"
[[claude.PermissionRequest.hooks]]
type = "prompt"
prompt = "Review this permission request."

[[codex.PreToolUse]]
matcher = "Bash"
[[codex.PreToolUse.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/pre-tool.sh"
statusMessage = "Checking Bash command"
```

The `[claude]` section accepts Claude-native events in addition to the shared top-level subset. This is where provider-specific events such as `WorktreeCreate`, `WorktreeRemove`, `PermissionDenied`, `PostToolUseFailure`, `PostCompact`, `FileChanged`, `ConfigChange`, and related Claude lifecycle hooks belong.

## Hook Events

OmniDev's shared top-level format still supports the existing OmniDev hook events, but providers use only what they can materialize. Claude gets the full shared set plus `[claude]` overrides. Codex uses its current documented subset and warns when shared hooks cannot be used there.

### Tool Execution Events

| Event | When it runs | Supports Matcher | Supports Prompt |
|-------|--------------|------------------|-----------------|
| `PreToolUse` | Before a tool executes | Yes | Yes |
| `PostToolUse` | After a tool completes | Yes | Yes |
| `PermissionRequest` | Before permission prompt shown | Yes | Yes |

### Workflow Events

| Event | When it runs | Supports Matcher | Supports Prompt |
|-------|--------------|------------------|-----------------|
| `UserPromptSubmit` | Before user prompt processed | No | Yes |
| `Stop` | When main agent finishes | No | Yes |
| `SubagentStop` | When subagent finishes | Yes | Yes |
| `Notification` | When notifications sent | Yes | No |

### Session Events

| Event | When it runs | Supports Matcher | Supports Prompt |
|-------|--------------|------------------|-----------------|
| `SessionStart` | When session starts/resumes | Yes | No |
| `SessionEnd` | When session ends | Yes | No |
| `PreCompact` | Before context compaction | Yes | No |

### Claude-only events in `[claude]`

Use the `[claude]` section for Claude lifecycle hooks that are not part of the shared top-level subset:

- `PermissionDenied`
- `PostToolUseFailure`
- `SubagentStart`
- `TaskCreated`
- `TaskCompleted`
- `StopFailure`
- `TeammateIdle`
- `InstructionsLoaded`
- `ConfigChange`
- `CwdChanged`
- `FileChanged`
- `WorktreeCreate`
- `WorktreeRemove`
- `PostCompact`
- `Elicitation`
- `ElicitationResult`

## Matchers

Matchers filter which tools or events trigger a hook. They use regex patterns.

### Tool Matchers

```toml
[[PreToolUse]]
matcher = "Bash"           # Exact match

[[PreToolUse]]
matcher = "Edit|Write"     # Match Edit OR Write

[[PreToolUse]]
matcher = "mcp__.*"        # All MCP tools

[[PreToolUse]]
matcher = ".*"             # All tools (or omit matcher)
```

**Common tool names**: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Task`, `WebFetch`, `WebSearch`, `NotebookEdit`, `LSP`, `TodoWrite`, `AskUserQuestion`

### Event-Specific Matchers

**Notification event**:
- `permission_prompt` - Permission prompts
- `idle_prompt` - Idle prompts
- `auth_success` - Auth success notifications
- `elicitation_dialog` - Elicitation dialogs

```toml
[[Notification]]
matcher = "permission_prompt"
[[Notification.hooks]]
type = "command"
command = "./notify.sh"
```

**SessionStart event**:
- `startup` - Initial session start
- `resume` - Session resumed
- `clear` - Session cleared
- `compact` - After compaction

```toml
[[SessionStart]]
matcher = "startup|resume"
[[SessionStart.hooks]]
type = "command"
command = "./init-session.sh"
```

**PreCompact event**:
- `manual` - Manual compaction
- `auto` - Auto compaction

### Events Without Matchers

For shared top-level hooks, `UserPromptSubmit`, `Stop`, and `SubagentStop` ignore `matcher`. Several Claude-only events in `[claude]` also ignore matchers, including `TaskCreated`, `TaskCompleted`, `TeammateIdle`, `CwdChanged`, `WorktreeCreate`, and `WorktreeRemove`.

```toml
[[Stop]]
[[Stop.hooks]]
type = "command"
command = "./cleanup.sh"
```

## Hook Types

### Command Hooks

Execute a shell command. Available for all events.

```toml
[[PreToolUse.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/validate.sh"
timeout = 60  # Default: 60 seconds
```

### Prompt Hooks

Use LLM evaluation. Supported for the shared Claude-compatible subset: `PreToolUse`, `PostToolUse`, `PermissionRequest`, `UserPromptSubmit`, `Stop`, and `SubagentStop`. Some Claude-only events in `[claude]` also support prompts, such as `PostToolUseFailure`, `TaskCreated`, and `TaskCompleted`.

```toml
[[PermissionRequest.hooks]]
type = "prompt"
prompt = "Review this permission request. Is it safe? Respond with JSON: {\"ok\": true} or {\"ok\": false, \"reason\": \"explanation\"}"
timeout = 30  # Default: 30 seconds
```

## Environment Variables

OmniDev uses its own variable naming throughout `hooks.toml`, including provider-specific sections:

| In hooks.toml | Provider output | Description |
|---------------|-----------------|-------------|
| `${OMNIDEV_CAPABILITY_ROOT}` | Resolved provider command path | Capability root directory |
| `${OMNIDEV_PROJECT_DIR}` | Resolved provider command path | Project root |

**Always use `OMNIDEV_` prefixed variables** in your authored `hooks.toml`. OmniDev resolves them before writing provider output.

Additional variables available at runtime:
- `CLAUDE_ENV_FILE` - (SessionStart only) File path for persisting environment variables

## Writing Hook Scripts

### Input Format

All hooks receive JSON via stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/project/path",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run tests"
  }
}
```

### Exit Codes

- **Exit 0**: Success, tool continues
- **Exit 2**: Blocking error, tool is prevented
- **Other codes**: Non-blocking error, logged but tool continues

### Simple Example

```bash
#!/bin/bash
# Read JSON input
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Block dangerous commands
if echo "$COMMAND" | grep -qE 'rm -rf /'; then
  echo "Dangerous command blocked" >&2
  exit 2
fi

exit 0
```

### Advanced JSON Output

For fine-grained control, output JSON to stdout with exit code 0:

```json
{
  "continue": true,
  "systemMessage": "Warning: this command modifies production data",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Auto-approved safe operation"
  }
}
```

**Permission decisions** (PreToolUse only):
- `"allow"` - Auto-approve without prompting
- `"deny"` - Block the operation
- `"ask"` - Show normal permission prompt

### Python Example

```python
#!/usr/bin/env python3
import json
import sys

# Read input
input_data = json.load(sys.stdin)
tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})

# Auto-approve reading documentation files
if tool_name == "Read":
    file_path = tool_input.get("file_path", "")
    if file_path.endswith((".md", ".txt", ".json")):
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "permissionDecisionReason": "Documentation file"
            }
        }
        print(json.dumps(output))
        sys.exit(0)

sys.exit(0)  # Default: continue normally
```

## How Sync Works

When you run [`omnidev sync`](/commands/core/#omnidev-sync):

1. OmniDev loads `hooks/hooks.toml` from each enabled capability
2. Separates shared hooks from `[claude]` and `[codex]` sections
3. Resolves `OMNIDEV_` variables to provider-ready command paths
4. Builds a provider-specific view of the hooks
5. Warns about hooks that are not usable in the active provider
6. Writes `.claude/settings.json` and/or `.codex/hooks.json`
7. Enables `features.codex_hooks` in `.codex/config.toml` when Codex hooks are present

### Merged Output

If two capabilities define hooks, they're combined:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/hooks/validate-bash.sh"
        }]
      },
      {
        "matcher": "Write",
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/hooks/lint-on-write.sh"
        }]
      }
    ]
  }
}
```

## Common Patterns

### Pre-commit Style Validation

Block dangerous bash commands:

```toml
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/validate-bash.sh"
timeout = 30
```

### Auto-format on Save

Run formatter after file edits:

```toml
[[PostToolUse]]
matcher = "Write|Edit"
[[PostToolUse.hooks]]
type = "command"
command = "${OMNIDEV_PROJECT_DIR}/node_modules/.bin/prettier --write"
```

### Context Loading at Session Start

Load project context when session begins:

```toml
[[SessionStart]]
matcher = "startup|resume"
[[SessionStart.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/load-context.sh"
```

Context script example:
```bash
#!/bin/bash
# Output is added as context to Claude
echo "Project: $(basename $PWD)"
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'not a git repo')"
echo "Node: $(node --version 2>/dev/null || echo 'not installed')"
exit 0
```

### Environment Variable Persistence

Set environment variables for the session:

```bash
#!/bin/bash
# SessionStart hook
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=development' >> "$CLAUDE_ENV_FILE"
  echo 'export DEBUG=true' >> "$CLAUDE_ENV_FILE"
fi
exit 0
```

### User Prompt Validation

Block prompts containing secrets:

```toml
[[UserPromptSubmit]]
[[UserPromptSubmit.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/check-secrets.sh"
```

```bash
#!/bin/bash
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt')

if echo "$PROMPT" | grep -qiE 'password=|api_key=|secret='; then
  echo '{"decision": "block", "reason": "Prompt may contain secrets"}'
  exit 0
fi

exit 0
```

## Validation

OmniDev validates hooks during capability loading:

- Unknown events are rejected
- Invalid hook types are rejected
- Prompt hooks on unsupported events are rejected
- Invalid regex patterns are rejected
- `CLAUDE_` variables are transformed to `OMNIDEV_` (with warning)
- Missing command/prompt fields are flagged

Run [`omnidev doctor`](/commands/core/#omnidev-doctor) to check for hook validation issues.

## Security Considerations

:::caution
Hooks execute arbitrary shell commands automatically. Use with care.
:::

Best practices:

1. **Validate and sanitize inputs** - Never trust input blindly
2. **Quote shell variables** - Use `"$VAR"` not `$VAR`
3. **Check for path traversal** - Block `..` in file paths
4. **Use absolute paths** - Specify full paths for scripts
5. **Skip sensitive files** - Avoid processing `.env`, `.git/`, keys
6. **Test scripts independently** - Ensure they work before integrating

## Debugging

Enable Claude Code debug mode to see hook execution:

```bash
claude --debug
```

Debug output shows:
```
[DEBUG] Executing hooks for PreToolUse:Bash
[DEBUG] Found 1 hook matchers
[DEBUG] Matched 1 hooks
[DEBUG] Hook command completed with status 0
```

## Related

- [Core Commands](/commands/core/) - `sync` and `doctor` commands
- [Capability Structure](/capabilities/structure/) - How to organize capabilities
- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks) - Full Claude specification
- [Codex Hooks Documentation](https://developers.openai.com/codex/hooks) - Full Codex specification
