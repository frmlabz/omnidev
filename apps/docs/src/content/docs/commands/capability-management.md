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

### Generated Files

```
.omni/capabilities/my-capability/
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
  Location: .omni/capabilities/api-client

  Files created:
    - capability.toml
    - skills/getting-started/SKILL.md
    - rules/coding-standards.md
    - hooks/hooks.toml
    - hooks/example-hook.sh

💡 To enable this capability, run:
   omnidev capability enable api-client
```

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
