---
title: Creating Capabilities
description: A complete guide to creating your own OmniDev capabilities.
sidebar:
  order: 1
---

This guide walks you through creating a new capability from scratch, including all the files you might need and best practices for structuring your capability.

## Quick start with `capability new`

The fastest way to create a capability is with the CLI:

```bash
omnidev capability new my-capability
```

The capability ID must be lowercase kebab-case (e.g., `my-capability`, `api-client`, `tasks`).

### Output location

By default, capabilities are created at `capabilities/<id>`. You can specify a custom path:

```bash
omnidev capability new my-cap --path ./custom/location
```

### Generated files

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

### Example output

```bash
omnidev capability new api-client
```

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

## Workflow: Creating and using local capabilities

1. Create a new capability:
   ```bash
   omnidev capability new my-cap
   ```

2. Add it as a local source:
   ```bash
   omnidev add cap --local ./capabilities/my-cap
   ```

3. The capability is now tracked in `omni.toml` and synced to your agents.

## Manual setup

If you prefer to create capabilities manually, here's what you need.

### Required: capability.toml

Every capability needs a `capability.toml` file at its root:

```toml
[capability]
id = "my-capability"
name = "My Capability"
version = "1.0.0"
description = "A short description of what this capability does."
```

**Field notes:**

- **id**: unique, kebab-case identifier. Avoid reserved names like `fs`, `path`, `react`, or `typescript`.
- **name**: human-readable title.
- **version**: semantic version string.
- **description**: short summary shown in listings.

### Optional: Programmatic exports (index.ts)

For dynamic content, create an `index.ts` file:

```typescript
import type { CapabilityExport } from "@omnidev-ai/core";

export default {
  cliCommands: { /* routes */ },
  docs: [/* DocExport */],
  rules: [/* markdown strings */],
  skills: [/* SkillExport */],
  gitignore: ["mycap/"],
  sync: async () => { /* setup */ }
} satisfies CapabilityExport;
```

### JavaScript with JSDoc

If you prefer JavaScript:

```javascript
/**
 * @type {import("@omnidev-ai/core").CapabilityExport}
 */
export default {
  gitignore: ["mycap/"]
};
```

## TypeScript types

OmniDev exports types from `@omnidev-ai/core` for type-checking your capabilities:

```typescript
import type {
  CapabilityExport,
  SkillExport,
  DocExport,
  FileContent
} from "@omnidev-ai/core";
```

## Best practices

### Naming

- Use kebab-case for capability IDs (`my-capability`).
- Use lowercase command names (`deploy`, `status`).
- Avoid reserved names like `fs`, `path`, `react`, `typescript`.

### Structure

- Keep CLI routes in `cli.ts` and export them from `index.ts`.
- Group related rules/docs/skills into focused subfolders.
- Use sync hooks sparingly and keep them idempotent.

### Static vs programmatic

- Prefer static files for stable content.
- Use programmatic exports for dynamic or generated content.
- When both are used, ensure output is deterministic.

### Gitignore patterns

Add patterns via programmatic export so OmniDev can manage them:

```typescript
export default {
  gitignore: ["mycap/", "*.mycap.log"]
} satisfies CapabilityExport;
```

### Sync hooks

Use a sync hook for one-time setup (create directories, seed config). Keep it safe to run multiple times.

```typescript
export default {
  sync: async () => {
    // create folders, write defaults, etc.
  }
} satisfies CapabilityExport;
```

## Testing your capability

```bash
omnidev capability enable my-capability
omnidev sync
omnidev mycap --help  # if you added CLI commands
```

## Publishing your capability

Once your capability is ready, you can share it by:

1. **Pushing to GitHub**: Others can reference it with `github:user/repo`
2. **Sharing the directory**: For local team use via `file://` sources

See [Capability Sources](/configuration/capability-sources/) for how others can add your capability.
