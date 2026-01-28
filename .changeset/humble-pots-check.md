---
"@omnidev-ai/core": patch
---

Fix TOML parsing error when capability README contains HTML with double quotes

Adds `escapeTomlString` helper to properly escape special characters (backslashes, double quotes, newlines, tabs) when generating capability.toml files from wrapped repositories.
