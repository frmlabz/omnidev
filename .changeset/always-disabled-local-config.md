---
"@omnidev-ai/core": minor
---

Add `always_disabled` support and improved `omni.local.toml` merging

- Added `always_disabled` option to `[capabilities]` section that removes capabilities from ALL profiles
- Supports group references in `always_disabled` (e.g., `group:noisy-tools`)
- Improved config merging for `omni.local.toml`:
  - Capability sources and groups are now properly deep-merged
  - `always_enabled` and `always_disabled` are combined from both configs
- Updated documentation with detailed merge behavior and examples
