---
title: CLI Commands
description: Extend the OmniDev CLI with capability commands.
sidebar:
  order: 4
---

Capabilities can add new CLI routes such as `omnidev ralph status`.

## Key rule

Always import `buildCommand` and `buildRouteMap` from `@omnidev-ai/core`, not from `@stricli/core`, to avoid duplicate Stricli instances.

## Example

```typescript
import { buildCommand, buildRouteMap } from "@omnidev-ai/core";
import type { CapabilityExport } from "@omnidev-ai/core";

const status = buildCommand({
  func: async () => {
    console.log("All systems go");
  },
  parameters: {},
  docs: { brief: "Show status" }
});

const routes = buildRouteMap({
  routes: { status },
  docs: { brief: "Ralph commands" }
});

export default {
  cliCommands: {
    ralph: routes
  }
} satisfies CapabilityExport;
```

This registers `omnidev ralph status`.
