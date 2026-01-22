# @omnidev-ai/capability

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
