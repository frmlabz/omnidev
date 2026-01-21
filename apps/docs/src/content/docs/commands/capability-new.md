---
title: capability new
description: Create a new capability with template files.
sidebar:
  order: 6
---

Create a new capability with all template files.

## Usage

```bash
omnidev capability new <id>
```

The capability ID must be lowercase kebab-case (e.g., `my-capability`, `api-client`, `tasks`).

## Options

### `--path`

Specify a custom output path:

```bash
omnidev capability new my-cap --path ./custom/location
```

Or interactively choose the path when prompted.

### `--programmatic`

Create a TypeScript capability with CLI commands and esbuild setup:

```bash
omnidev capability new my-cap --programmatic
```

This adds the following files for building a programmatic capability:

- `package.json` - Node.js package with esbuild build script
- `index.ts` - TypeScript entry point with CLI command template
- `.gitignore` - Ignores `dist/` and `node_modules/`

## Generated files

### Standard capability

```
capabilities/my-capability/
├── capability.toml               # Capability metadata
├── skills/
│   └── getting-started/
│       └── SKILL.md              # Skill template
├── rules/
│   └── coding-standards.md       # Rule template
└── hooks/
    ├── hooks.toml                # Hook configuration
    └── example-hook.sh           # Example hook script
```

### Programmatic capability (with `--programmatic`)

```
capabilities/my-capability/
├── capability.toml               # Capability metadata
├── package.json                  # Node.js package config
├── index.ts                      # TypeScript entry point with CLI commands
├── .gitignore                    # Git ignore for dist/ and node_modules/
├── skills/
│   └── getting-started/
│       └── SKILL.md              # Skill template
├── rules/
│   └── coding-standards.md       # Rule template
└── hooks/
    ├── hooks.toml                # Hook configuration
    └── example-hook.sh           # Example hook script
```

Delete any files you don't need after creation.

## Example

### Standard capability

```bash
omnidev capability new api-client
```

Output:
```
✓ Created capability: Api Client
  Location: capabilities/api-client

  Files created:
    - capability.toml
    - skills/getting-started/SKILL.md
    - rules/coding-standards.md
    - hooks/hooks.toml
    - hooks/example-hook.sh

💡 To add this capability as a local source, run:
   omnidev add cap --local ./capabilities/api-client
```

### Programmatic capability

```bash
omnidev capability new my-cli --programmatic
```

Output:
```
✓ Created capability: My Cli
  Location: capabilities/my-cli

  Files created:
    - capability.toml
    - skills/getting-started/SKILL.md
    - rules/coding-standards.md
    - hooks/hooks.toml
    - hooks/example-hook.sh
    - package.json
    - index.ts
    - .gitignore

💡 To build and use this capability:
   cd capabilities/my-cli
   npm install && npm run build
   cd -
   omnidev add cap --local ./capabilities/my-cli
```

## Workflow

### Standard capability

1. Create a new capability:
   ```bash
   omnidev capability new my-cap
   ```

2. Add it as a local source:
   ```bash
   omnidev add cap --local ./capabilities/my-cap
   ```

3. The capability is now tracked in `omni.toml` and synced to your agents.

### Programmatic capability

1. Create a new programmatic capability:
   ```bash
   omnidev capability new my-cli --programmatic
   ```

2. Install dependencies and build:
   ```bash
   cd capabilities/my-cli
   npm install && npm run build
   cd -
   ```

3. Add it as a local source:
   ```bash
   omnidev add cap --local ./capabilities/my-cli
   ```

4. Run `omnidev sync` to make the CLI commands available:
   ```bash
   omnidev sync
   omnidev my-cli  # Run your new command!
   ```

---

For a complete guide on capability development, see [Creating Capabilities](/advanced/creating-capabilities/).
