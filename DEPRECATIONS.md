# Deprecations

This file tracks OmniDev formats and behaviors that are deprecated and expected to be removed in a future release.

| Status | Deprecated In | Removal Target | Area | Deprecated | Replacement | Notes |
|--------|---------------|----------------|------|------------|-------------|-------|
| Active | 2026-03-31 | TBD | Subagents | `subagents/**/SUBAGENT.md` and `subagents/**/AGENT.md` | `subagents/<name>/agent.toml` + `subagents/<name>/prompt.md` | Legacy Markdown-based subagents are still loaded for compatibility, but the neutral manifest is now the canonical format because it can target both Claude and Codex cleanly. When both formats exist for the same agent, OmniDev prefers `agent.toml` + `prompt.md`. |
