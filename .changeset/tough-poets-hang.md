---
'@omnidev-ai/cli': minor
---

Add provider-scoped `OMNI.md` blocks and provider-specific capability targeting.

Provider names are now normalized across sync behavior, including support for `claude` as an alias of `claude-code`. Capabilities can opt into specific providers with `[capability.adapters]`, and provider-specific instructions in `OMNI.md` are only rendered into matching provider outputs.
