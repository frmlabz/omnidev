---
title: CLI Commands
description: Extend the OmniDev CLI with capability commands.
sidebar:
  order: 4
---

Capabilities can add new CLI routes such as `omnidev ralph status`.

## Setup

Import `command` and `routes` from `@omnidev-ai/capability`:

```typescript
import { command, routes, type CapabilityExport } from "@omnidev-ai/capability";
```

## Example

```typescript
import { command, routes, type CapabilityExport } from "@omnidev-ai/capability";

const status = command({
  brief: "Show status",
  parameters: {
    flags: {
      verbose: {
        brief: "Show detailed status",
        kind: "boolean",
        optional: true,
      },
    },
  },
  async func(flags) {
    console.log("All systems go");
    if (flags.verbose) {
      console.log("Details: everything is working");
    }
  },
});

const ralphRoutes = routes({
  brief: "Ralph commands",
  routes: { status },
});

export default {
  cliCommands: {
    ralph: ralphRoutes,
  },
} satisfies CapabilityExport;
```

This registers `omnidev ralph status`.

## Command Definition

Use the `command()` function to define commands:

```typescript
const myCommand = command({
  brief: "Short description shown in help",
  fullDescription: "Longer description shown in command help",
  parameters: {
    flags: {
      // Named flags
      verbose: {
        brief: "Show verbose output",
        kind: "boolean",
        optional: true,
      },
      output: {
        brief: "Output format",
        kind: "enum",
        values: ["json", "yaml", "text"],
        default: "text",
      },
      count: {
        brief: "Number of items",
        kind: "number",
        optional: true,
      },
    },
    positional: [
      // Positional arguments
      {
        brief: "Input file",
        kind: "string",
      },
    ],
    aliases: {
      v: "verbose",
      o: "output",
    },
  },
  async func(flags, inputFile) {
    // flags.verbose, flags.output, flags.count are typed
    // inputFile is the positional argument
  },
});
```

## Flag Kinds

| Kind | Description | Example |
|------|-------------|---------|
| `boolean` | True/false flag | `--verbose` |
| `string` | String value | `--name "foo"` |
| `number` | Numeric value | `--count 5` |
| `enum` | One of allowed values | `--format json` |

## Route Maps

Use `routes()` to group related commands:

```typescript
const taskRoutes = routes({
  brief: "Manage tasks",
  routes: {
    list: listCommand,
    add: addCommand,
    complete: completeCommand,
  },
});
```

This creates:
- `omnidev tasks list`
- `omnidev tasks add`
- `omnidev tasks complete`

## Nested Routes

Route maps can be nested:

```typescript
const projectRoutes = routes({
  brief: "Project management",
  routes: {
    tasks: taskRoutes,  // omnidev project tasks list
    issues: issueRoutes, // omnidev project issues list
  },
});
```

## Building

Build your capability with:

```bash
npx @omnidev-ai/capability build
```

Or in watch mode:

```bash
npx @omnidev-ai/capability build --watch
```
