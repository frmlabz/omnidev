---
title: Capability Management
description: Create, list, enable, and disable capabilities.
sidebar:
  order: 2
---

## `omnidev capability new <id>`

Create a new capability with all template files.

```bash
omnidev capability new my-capability
```

The capability ID must be lowercase kebab-case (e.g., `my-capability`, `api-client`, `tasks`).

### Output Location

By default, capabilities are created at `capabilities/<id>`. You can specify a custom path using the `--path` flag:

```bash
omnidev capability new my-cap --path ./custom/location
```

Or interactively choose the path when prompted.

### Generated Files

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

Delete any files you don't need after creation.

### Example

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

### Workflow: Creating and Using Local Capabilities

1. Create a new capability:
   ```bash
   omnidev capability new my-cap
   ```

2. Add it as a local source:
   ```bash
   omnidev add cap --local ./capabilities/my-cap
   ```

3. The capability is now tracked in `omni.toml` and synced to your agents.

## `omnidev capability list`

List discovered capabilities and their enabled status.

```bash
omnidev capability list
```

## `omnidev capability enable <name>`

Enable a capability in the active profile.

```bash
omnidev capability enable tasks
```

## `omnidev capability disable <name>`

Disable a capability in the active profile.

```bash
omnidev capability disable tasks
```

After enabling or disabling, run:

```bash
omnidev sync
```
