---
'@omnidev-ai/cli': minor
'@omnidev-ai/capability': minor
---

Add capability-local MCP env interpolation and scaffold `.env` gitignores.

Capabilities can now resolve `${VAR}` placeholders in MCP config from a `.env` file next to `capability.toml`, with shell environment variables taking precedence and unresolved values failing fast. Capability scaffolds now create a `.gitignore` that ignores `.env`, and programmatic scaffolds continue to ignore build artifacts as well.
