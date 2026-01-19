---
title: Type Exports
description: TypeScript helpers for capability authors.
sidebar:
  order: 11
---

OmniDev exports types from `@omnidev-ai/core` so capabilities can be type-checked.

## Common imports

```typescript
import type {
  CapabilityExport,
  SkillExport,
  DocExport,
  FileContent
} from "@omnidev-ai/core";
```

## Basic usage

```typescript
import type { CapabilityExport } from "@omnidev-ai/core";

export default {
  gitignore: ["mycap/"]
} satisfies CapabilityExport;
```

## JavaScript with JSDoc

```javascript
/**
 * @type {import("@omnidev-ai/core").CapabilityExport}
 */
export default {
  gitignore: ["mycap/"]
};
```
