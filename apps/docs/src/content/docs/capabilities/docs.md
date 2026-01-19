---
title: Docs
description: Ship long-form guidance with your capability.
sidebar:
  order: 8
---

Capability docs are markdown files that provide longer explanations, examples, or workflows. They are merged into `.omni/instructions.md` during sync.

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
