---
"@omnidev-ai/core": patch
"@omnidev-ai/cli": patch
---

Wrap Claude plugin repositories that declare their skills through `marketplace.json`.

- Materialize skills listed in `plugins[].skills[].path` into the canonical `skills/` layout before wrapping copies or prunes content, so marketplace-declared skill directories are no longer discarded. Paths are resolved against the repository root and rejected if they escape it.
- Treat a repository containing only `.claude-plugin/marketplace.json` as wrappable; previously only `plugin.json` was recognized, so marketplace-only repositories were never wrapped at all.
- Parse YAML block scalars (`|`, `>`, with `-`/`+` chomping) in skill frontmatter. Multi-line descriptions were previously reduced to the literal indicator character, and their indented continuation lines were misread as additional frontmatter keys.
