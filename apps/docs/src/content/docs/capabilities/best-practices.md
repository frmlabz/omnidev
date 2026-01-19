---
title: Best Practices
description: Patterns for maintainable capabilities.
sidebar:
  order: 12
---

## Naming

- Use kebab-case for capability IDs (`my-capability`).
- Use lowercase command names (`deploy`, `status`).
- Avoid reserved names like `fs`, `path`, `react`, `typescript`.

## Structure

- Keep CLI routes in `cli.ts` and export them from `index.ts`.
- Group related rules/docs/skills into focused subfolders.
- Use `types.d.ts` only for type hints you want agents to see.
- Use sync hooks sparingly and keep them idempotent.

## Static vs programmatic

- Prefer static files for stable content.
- Use programmatic exports for dynamic or generated content.
- When both are used, ensure output is deterministic.

## Gitignore patterns

Add patterns via programmatic export so OmniDev can manage them:

```typescript
export default {
  gitignore: ["mycap/", "*.mycap.log"]
} satisfies CapabilityExport;
```

## Sync hooks

Use a sync hook for one-time setup (create directories, seed config). Keep it safe to run multiple times.

```typescript
export default {
  sync: async () => {
    // create folders, write defaults, etc.
  }
} satisfies CapabilityExport;
```

## Testing

```bash
omnidev capability enable my-capability
omnidev sync
omnidev mycap --help
```
