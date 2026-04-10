---
"@omnidev-ai/core": patch
---

Fix hook capability-root expansion to use absolute paths when loading capabilities. This prevents Claude hook commands in `.claude/settings.json` from resolving relative to an unexpected working directory and failing to start.
