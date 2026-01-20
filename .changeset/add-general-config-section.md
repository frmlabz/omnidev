---
"@omnidev-ai/core": minor
"@omnidev-ai/cli": minor
"@omnidev-ai/adapters": minor
---

Add [general] section to omni.toml configuration for project, active_profile, and always_enabled_capabilities settings. This prevents TOML parsing issues where root-level keys placed after section headers were incorrectly parsed as belonging to those sections.
