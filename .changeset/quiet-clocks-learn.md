---
"@omnidev-ai/core": patch
"@omnidev-ai/cli": patch
---

Serialize capability dependency installation so concurrent CLI invocations do not race while mutating capability-local node_modules.
