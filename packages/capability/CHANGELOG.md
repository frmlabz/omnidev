# @omnidev-ai/capability

## 0.19.1

## 0.19.0

### Minor Changes

- e58a7bc: Add Codex subagent generation and move OmniDev subagents to a neutral `agent.toml` plus `prompt.md` format with legacy `SUBAGENT.md` compatibility.

## 0.18.1

## 0.18.0

## 0.17.0

### Minor Changes

- faefd40: Add capability-local MCP env interpolation and scaffold `.env` gitignores.

  Capabilities can now resolve `${VAR}` placeholders in MCP config from a `.env` file next to `capability.toml`, with shell environment variables taking precedence and unresolved values failing fast. Capability scaffolds now create a `.gitignore` that ignores `.env`, and programmatic scaffolds continue to ignore build artifacts as well.

## 0.16.0

### Minor Changes

- 1f73762: Do a minor bump

## 0.14.0

### Patch Changes

- 2f0e614: Minor fixes preparing for launch
- c98c316: Change how internally packages are imported, move away from relative imports with `.js` extension to node subpath imports

## 0.13.4

### Patch Changes

- 6ad2f66: Export debug func

## 0.13.3

### Patch Changes

- 4548796: Fix CLI shebang issue when package is imported as ES module

  Uses a thin shim pattern to separate the executable entry point from bundled code. The shim file (`bin/capability.js`) contains only the shebang and an import, ensuring the shebang is always on line 1 regardless of bundler output.

  Also updates capability list help message to point to `omnidev add cap` command.

## 0.13.2

### Patch Changes

- a7eddd9: Fixes v2

## 0.13.1

## 0.13.0

### Minor Changes

- 0c88759: Fixes
- 4a72cc4: Changing how packages work
