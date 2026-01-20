---
title: Docs (WIP)
description: Ship long-form guidance with your capability.
sidebar:
  order: 8
---

:warning: This feature is currently a work in progress. I have some things planned for docs but they also might be removed in the near future.

Capability docs are markdown files that provide longer explanations, examples, or workflows. They are embedded directly into provider files (like `CLAUDE.md` or `AGENTS.md`) during sync.

## Structure

```
my-capability/
└── docs/
    ├── overview.md
    └── usage.md
```

## Programmatic docs

```typescript
import type { CapabilityExport } from "@omnidev-ai/core";

export default {
  docs: [
    {
      title: "Overview",
      content: "# Overview\n\nThis capability provides..."
    }
  ]
} satisfies CapabilityExport;
```
