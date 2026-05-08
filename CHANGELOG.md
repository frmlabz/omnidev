# Changelog

## Codex Hooks Support

**Packages:** `@omnidev-ai/cli`, `@omnidev-ai/core`, `@omnidev-ai/adapters`

Hooks defined in `hooks/hooks.toml` now target both Claude Code and Codex from a single source file. OmniDev writes `.codex/hooks.json` and automatically enables `features.hooks` in `.codex/config.toml`.

### What changed

- `hooks/hooks.toml` now supports optional `[claude]` and `[codex]` provider sections alongside shared top-level events.
- If a provider section defines an event, it **replaces** the shared event for that provider only.
- Shared hooks that are not usable on a provider are skipped with warnings instead of failing sync.
- Codex supports a subset of hook events: `SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`.
- Codex hooks support `statusMessage` field on hook entries.
- `OMNIDEV_CAPABILITY_ROOT` and `OMNIDEV_PROJECT_DIR` variables are resolved before writing provider output (no longer mapped 1:1 to `CLAUDE_` prefixed vars).

### Example

```toml
# hooks/hooks.toml

# Shared across providers
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/validate-bash.sh"

# Codex-only override
[[codex.PreToolUse]]
matcher = "Bash"
[[codex.PreToolUse.hooks]]
type = "command"
command = "${OMNIDEV_CAPABILITY_ROOT}/hooks/validate-bash.sh"
statusMessage = "Checking Bash command"

# Claude-only hook (event not available on Codex)
[[claude.PermissionRequest]]
matcher = "Bash"
[[claude.PermissionRequest.hooks]]
type = "prompt"
prompt = "Review this request before approval."
```

### Migration

No breaking changes. Existing `hooks/hooks.toml` files continue to work as before — all top-level events are treated as shared hooks and written to Claude Code. To target Codex, either rely on shared hooks (Codex-compatible events are forwarded automatically) or add a `[codex]` section.

---

## Codex Subagent Support & Neutral Agent Manifests

**Packages:** `@omnidev-ai/cli`, `@omnidev-ai/core`, `@omnidev-ai/adapters`, `@omnidev-ai/capability`

Subagents can now target Codex alongside Claude Code, Cursor, and OpenCode. The authoring format moves from `SUBAGENT.md` with YAML frontmatter to a neutral `agent.toml` + `prompt.md` pair.

### What changed

- New canonical subagent format: `subagents/<name>/agent.toml` + `subagents/<name>/prompt.md`.
- `agent.toml` has shared fields (`name`, `description`) and provider-specific sections (`[claude]`, `[codex]`).
- OmniDev now writes `.codex/agents/<name>.toml` with Codex-native fields: `model`, `model_reasoning_effort`, `sandbox_mode`, `nickname_candidates`, `developer_instructions`.
- Legacy `SUBAGENT.md` and `AGENT.md` files are still loaded but **deprecated**. When both formats exist for the same agent, `agent.toml` + `prompt.md` wins.
- Top-level `Subagent` fields (`tools`, `model`, `permissionMode`, etc.) are deprecated compatibility aliases for `subagent.claude.*`.
- Programmatic `SubagentExport` now accepts `agentToml` + `promptMd` alongside the legacy `subagentMd`.

### New `agent.toml` format

```toml
name = "code-reviewer"
description = "Reviews code for quality and best practices"

[claude]
tools = ["Read", "Glob", "Grep"]
model = "sonnet"
permission_mode = "acceptEdits"

[codex]
model = "gpt-5.4"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
nickname_candidates = ["Atlas", "Delta"]
```

### `[claude]` fields

| Field | Description |
|-------|-------------|
| `tools` | Tool allowlist |
| `disallowed_tools` | Tools to remove from allowlist |
| `model` | `sonnet`, `opus`, `haiku`, or `inherit` |
| `permission_mode` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `skills` | Skills to preload |
| `hooks` | Claude-scoped lifecycle hooks |

### `[codex]` fields

| Field | Description |
|-------|-------------|
| `model` | Full Codex model ID (e.g. `gpt-5.4`) |
| `model_reasoning_effort` | `low`, `medium`, `high`, `xhigh` |
| `sandbox_mode` | `read-only`, `workspace-write`, `danger-full-access` |
| `nickname_candidates` | Display nicknames for spawned agents |

### Programmatic export

```typescript
import type { CapabilityExport, SubagentExport } from "@omnidev-ai/core";

const reviewer: SubagentExport = {
  agentToml: `name = "code-reviewer"
description = "Reviews code for quality and best practices"

[claude]
tools = ["Read", "Glob", "Grep"]

[codex]
model = "gpt-5.4"`,
  promptMd: "Review the diff and report concrete defects."
};

export default {
  subagents: [reviewer]
} satisfies CapabilityExport;
```

### Migration

1. **Rename subagent files** (recommended, not required yet):
   ```
   # Before
   subagents/code-reviewer/SUBAGENT.md

   # After
   subagents/code-reviewer/agent.toml
   subagents/code-reviewer/prompt.md
   ```
2. **Move frontmatter to `agent.toml`**: Extract `name`, `description` into top-level fields. Move `tools`, `model`, `permissionMode`, etc. under `[claude]`. Add `[codex]` if targeting Codex.
3. **Move prompt body to `prompt.md`**: The markdown content below the frontmatter becomes `prompt.md`.
4. **Programmatic capabilities**: Replace `subagentMd` with `agentToml` + `promptMd` in your exports.

Legacy `SUBAGENT.md` files continue to work. No immediate action required, but the format will be removed in a future release. Deprecation details are tracked in `DEPRECATIONS.md`.
