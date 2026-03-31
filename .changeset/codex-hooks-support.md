---
"@omnidev-ai/cli": minor
---

Add Codex hooks support from shared capability `hooks/hooks.toml` files, including provider-specific `[claude]` and `[codex]` hook sections, `.codex/hooks.json` generation, and automatic `codex_hooks` feature enablement. Shared hooks now warn and skip when they are not usable on a provider instead of failing sync, while invalid provider-specific hook overrides are validated during load.
