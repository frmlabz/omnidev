---
title: Rules
description: Provide guidelines and constraints for AI agents.
sidebar:
  order: 7
---

Rules are markdown files that provide guidance to AI agents. They are embedded directly into provider files (like `CLAUDE.md` or `AGENTS.md`) under a `## Rules` section during sync.

## Structure

```
my-capability/
└── rules/
    ├── coding-standards.md
    └── architecture.md
```

## Format

Each rule file should start with a `###` header (ideally the rule name), followed by the rule content:

```markdown
### Coding Standards

- Use camelCase for variables
- Keep functions small and focused
- Prefer async/await over callbacks
```

The `###` header is recommended so rules are properly organized under the `## Rules` section in the output.

## Example output

When synced, rules appear in your provider file like this:

```markdown
## Rules

### Coding Standards

- Use camelCase for variables
- Keep functions small and focused

### Architecture Guidelines

- Keep components small and focused
- Use dependency injection
```

## Programmatic rules

You can also define rules programmatically in your capability's `index.ts`:

```typescript
import type { CapabilityExport } from "@omnidev-ai/core";

export default {
  rules: [
    "### Release Checklist\n\n- [ ] Tests pass\n- [ ] Changelog updated"
  ]
} satisfies CapabilityExport;
```
