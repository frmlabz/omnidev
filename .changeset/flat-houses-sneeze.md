---
"@omnidev-ai/adapters": patch
"@omnidev-ai/cli": patch
"@omnidev-ai/core": patch
---

Track provider-generated outputs in the sync manifest so `omnidev sync` can remove stale managed skills, rules, agents, commands, and config files without deleting user-modified files.
