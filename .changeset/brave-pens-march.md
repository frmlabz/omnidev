---
"@omnidev-ai/capability": patch
"@omnidev-ai/cli": patch
---

Fix CLI shebang issue when package is imported as ES module

Uses a thin shim pattern to separate the executable entry point from bundled code. The shim file (`bin/capability.js`) contains only the shebang and an import, ensuring the shebang is always on line 1 regardless of bundler output.

Also updates capability list help message to point to `omnidev add cap` command.
