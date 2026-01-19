---
title: Rules
description: Provide guidelines and constraints for AI agents.
sidebar:
  order: 7
---

Rules are markdown files that provide guidance to AI agents. They are merged into `.omni/instructions.md` during sync.

## Structure

```
my-capability/
└── rules/
    ├── coding-standards.md
    └── architecture.md
```

## Example rule

```markdown
# Coding Standards

- Use camelCase for variables
- Keep functions small and focused
```

## Programmatic rules

```typescript
import type { CapabilityExport } from "@omnidev-ai/core";

export default {
  rules: [
    "# Release Checklist\n\n- [ ] Tests pass\n- [ ] Changelog updated"
  ]
} satisfies CapabilityExport;
```
