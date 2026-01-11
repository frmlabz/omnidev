# Capability Development Guide

## Overview

Capabilities are the core extension mechanism in OmniDev. They allow you to add new features to your development workflow by providing:

- CLI commands
- MCP tools
- Documentation
- Rules for AI agents
- Skills for specific tasks
- Custom gitignore patterns
- Sync hooks for initialization

## Capability Structure

A typical capability has this directory structure:

```
capabilities/my-capability/
├── capability.toml       # Metadata and configuration
├── index.ts              # Main export (REQUIRED)
├── cli.ts                # CLI command definitions (optional)
├── mcp.ts                # MCP tool definitions (optional)
├── sync.ts               # Sync hook implementation (optional)
├── rules/                # Rule markdown files (optional)
│   ├── coding-standards.md
│   └── architecture.md
├── skills/               # Skill definitions (optional)
│   └── my-skill/
│       └── SKILL.md
└── docs/                 # Documentation (optional)
    ├── overview.md
    └── usage.md
```

### TypeScript Setup

To get type checking and autocompletion for your capability, import the types from `@omnidev/core`:

```typescript
import type { CapabilityExport, SkillExport, DocExport, FileContent } from "@omnidev/core";
```

**Available types:**
- `CapabilityExport` - Main export interface for capabilities
- `SkillExport` - Skill definition structure
- `DocExport` - Documentation structure
- `FileContent` - File name and content pair
- `McpToolExport` - MCP tool definition (TODO: complete spec)

Using `satisfies CapabilityExport` ensures your export structure is correct at compile time.

## Export Interface

Capabilities can provide content in **two ways**:

### 1. Static Files (Recommended for simple content)

Create files in your capability directory:

```
capabilities/my-capability/
├── docs/
│   ├── overview.md
│   └── usage.md
├── rules/
│   ├── coding-standards.md
│   └── architecture.md
└── skills/
    └── my-skill/
        ├── SKILL.md
        └── template.json
```

These files are automatically discovered and loaded during sync.

### 2. Programmatic Exports (For dynamic content)

Export content from `index.ts`:

```typescript
import type { CapabilityExport } from "@omnidev/core";

export default {
  cliCommands: { /* ... */ },
  mcpTools: { /* ... */ },
  docs: [ /* programmatically generated */ ],
  rules: [ /* programmatically generated */ ],
  skills: [ /* programmatically generated */ ],
  gitignore: [ /* ... */ ],
  sync: async () => { /* ... */ }
} satisfies CapabilityExport;
```

### 3. Hybrid Approach (Best of both)

You can use **both** approaches! Static files and programmatic exports are merged together.

**Use static files for:**
- Content that doesn't change often
- Content that's easy to edit manually
- Documentation and guides

**Use programmatic exports for:**
- Dynamically generated content
- Template-based content
- Content that depends on configuration
- Files that need to be created with specific names/structure

### CLI Commands

Add CLI commands that appear in `omnidev <command>`:

```typescript
import { buildRouteMap, buildCommand } from "@stricli/core";

// Define commands using stricli
const myCommand = buildCommand({
  func: async (flags, arg1, arg2) => {
    // Command implementation
  },
  parameters: {
    flags: {
      verbose: {
        kind: "boolean" as const,
        brief: "Enable verbose output",
        optional: true
      }
    },
    positional: {
      kind: "tuple" as const,
      parameters: [
        { brief: "First argument", parse: String },
        { brief: "Second argument", parse: String }
      ]
    }
  },
  docs: {
    brief: "Brief description of command"
  }
});

// Build route map
const myRoutes = buildRouteMap({
  routes: {
    init: myCommand,
    // ... more commands
  },
  docs: {
    brief: "My capability commands"
  }
});

// Export in default object
export default {
  cliCommands: {
    mycap: myRoutes  // Creates 'omnidev mycap' command
  }
};
```

**Command naming:**
- The key (`mycap`) becomes the CLI command name
- You can export multiple commands from one capability

### MCP Server Wrapping

Capabilities can wrap external MCP servers, exposing their tools to the OmniDev sandbox. This is the recommended way to integrate third-party MCP servers.

#### Basic MCP Wrapper

Add an `[mcp]` section to your `capability.toml`:

```toml
[capability]
id = "context7"
name = "Context7 Documentation"
version = "1.0.0"
description = "Query up-to-date library documentation via Context7 MCP"

[mcp]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
transport = "stdio"
```

**MCP Configuration Options:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | Command to run the MCP server |
| `args` | string[] | No | Arguments to pass to the command |
| `env` | object | No | Environment variables for the MCP process |
| `cwd` | string | No | Working directory (defaults to project root) |
| `transport` | string | No | Transport type: `stdio` (default), `sse`, or `http` |

#### How It Works

1. When OmniDev starts, it spawns child MCP processes for enabled capabilities with `[mcp]` sections
2. The MCP Controller connects to each child MCP and discovers its tools
3. TypeScript wrapper functions are auto-generated for each tool
4. Sandbox code can import and call these tools directly

#### Example: Context7 Capability

**capability.toml:**
```toml
[capability]
id = "context7"
name = "Context7 Documentation"
version = "1.0.0"
description = "Query library documentation"

[mcp]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
transport = "stdio"
```

**index.ts:**
```typescript
import type { CapabilityExport } from "@omnidev/core";

export default {
  docs: [{
    title: "Context7 Usage",
    content: `# Context7 Documentation Lookup

Use to query up-to-date library documentation.

\`\`\`typescript
import { resolveLibraryId, queryDocs } from "context7";

const libId = await resolveLibraryId({ query: "hooks", libraryName: "react" });
const docs = await queryDocs({ libraryId: libId, query: "useState" });
\`\`\`
`
  }],
} satisfies CapabilityExport;
```

**types.d.ts** (optional, for better IDE support):
```typescript
export interface ResolveLibraryIdArgs {
  query: string;
  libraryName: string;
}

export interface QueryDocsArgs {
  libraryId: string;
  query: string;
}

export function resolveLibraryId(args: ResolveLibraryIdArgs): Promise<unknown>;
export function queryDocs(args: QueryDocsArgs): Promise<unknown>;
```

#### Using Wrapped MCP Tools in Sandbox

Once a capability with `[mcp]` is enabled, sandbox code can import its tools:

```typescript
// In omni_execute code
import { resolveLibraryId, queryDocs } from "context7";

export async function main(): Promise<number> {
  // Resolve library name to Context7 ID
  const libId = await resolveLibraryId({
    query: "react hooks tutorial",
    libraryName: "react"
  });

  // Query documentation
  const docs = await queryDocs({
    libraryId: libId,
    query: "useState examples"
  });

  console.log(docs);
  return 0;
}
```

#### Checking MCP Status

Use the CLI to check the status of running MCP children:

```bash
omnidev mcp status
```

Output:
```
=== MCP Controller Status ===

Last updated: 2024-01-15T10:30:00.000Z
Relay port:   9876

Child Processes (1):

  ✓ context7
      Status:    connected
      Transport: stdio
      PID:       12345
      Tools:     2
      Last check: 2024-01-15T10:30:00.000Z
```

#### Transport Support

| Transport | Status | Notes |
|-----------|--------|-------|
| `stdio` | Supported | Default, most common |
| `sse` | Planned | Server-Sent Events |
| `http` | Planned | Streamable HTTP |

#### Environment Variables

Pass environment variables to the MCP process:

```toml
[mcp]
command = "npx"
args = ["-y", "@some/mcp-server"]
transport = "stdio"

[mcp.env]
API_KEY = "${SOME_API_KEY}"
DEBUG = "true"
```

#### Troubleshooting

**MCP not connecting:**
1. Check `omnidev mcp status` for error messages
2. Verify the command works standalone: `npx -y @some/mcp-server`
3. Check `.omni/logs/mcp-server.log` for detailed errors

**Tools not available in sandbox:**
1. Ensure the capability is enabled: `omnidev capability list`
2. Restart the server: `omnidev serve`
3. Check that wrappers were generated in `.omni/sandbox/node_modules/<capability-id>/`

### MCP Tools (Programmatic)

For custom MCP tools defined in TypeScript (not wrapping external MCPs):

```typescript
export default {
  mcpTools: {
    my_tool: {
      name: "my_tool",
      description: "Description of what this tool does",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query"
          }
        },
        required: ["query"]
      },
      handler: async (input: { query: string }) => {
        // Tool implementation
        return { result: "..." };
      }
    }
  }
};
```

**Note**: Programmatic MCP tool structure is still being designed. For now, prefer wrapping external MCP servers using the `[mcp]` configuration.

### Documentation

**Option 1: Static files (recommended)**

Create markdown files in `docs/` directory:

```
capabilities/my-capability/
└── docs/
    ├── overview.md
    ├── usage.md
    └── examples.md
```

**Option 2: Programmatic export**

Generate docs dynamically in your export:

```typescript
export default {
  docs: [
    {
      title: "Overview",
      content: "# My Capability\n\nThis capability provides..."
    },
    {
      title: "Usage",
      content: `# Usage\n\n\`\`\`bash\nomnidev mycap command\n\`\`\``
    }
  ]
};
```

**Documentation best practices:**
- Keep docs focused and concise
- Use examples to illustrate usage
- Include troubleshooting section

### Rules

Rules provide guidance to AI agents about how to work with your capability.

**Option 1: Static files (recommended)**

Create markdown files in `rules/` directory:

```
capabilities/my-capability/
└── rules/
    ├── coding-standards.md
    ├── architecture.md
    └── best-practices.md
```

Each file contains markdown content:

```markdown
# Coding Standards

## Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and types

## Code Organization

- Keep files focused on single responsibility
- Group related functionality together
```

**Option 2: Programmatic export**

Generate rules dynamically:

```typescript
export default {
  rules: [
    `# Coding Standards

## Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and types`,

    `# Architecture

Follow the repository's established patterns...`
  ]
};
```

Rules are aggregated and written to `.omni/instructions.md` during sync.

### Skills

Skills are reusable task definitions that AI agents can invoke.

**Option 1: Static files (recommended)**

Create skill directories in `skills/`:

```
capabilities/my-capability/
└── skills/
    └── deploy/
        ├── SKILL.md
        ├── deploy-script.sh
        └── config-template.yml
```

**SKILL.md format:**
```markdown
---
name: deploy
description: "Deploy application to production"
---

# Deploy Skill

This skill deploys the application to production.

## Prerequisites

- Production credentials configured
- Application built and tested

## Steps

1. Run pre-deployment checks
2. Build production bundle
3. Deploy to server
4. Run post-deployment verification
```

All files in the skill directory (except SKILL.md) become references automatically.

**Option 2: Programmatic export**

Generate skills dynamically:

```typescript
export default {
  skills: [
    {
      // The SKILL.md content
      skillMd: `---
name: deploy
description: "Deploy application to production"
---

# Deploy Skill

Steps to deploy...`,

      // Reference files (files created in skill directory)
      references: [
        {
          name: "deploy-script.sh",
          content: "#!/bin/bash\necho 'Deploying...'"
        },
        {
          name: "config.json",
          content: JSON.stringify({ env: "prod" }, null, 2)
        }
      ],

      // Additional files (optional)
      additionalFiles: [
        {
          name: "template.yml",
          content: "apiVersion: v1\nkind: Pod..."
        }
      ]
    }
  ]
};
```

**Skill structure:**
- `skillMd`: SKILL.md content (required) - string with YAML frontmatter + markdown
- `references`: Array of `{name, content}` objects - files the skill uses (optional)
- `additionalFiles`: Array of `{name, content}` objects - templates, examples (optional)

Skills are written to `.claude/skills/` during sync.

### Gitignore Patterns

Specify patterns to exclude from version control:

```typescript
export default {
  gitignore: [
    "mycap/",              // Directory
    "*.mycap.log",         // Pattern
    ".mycap-cache"         // File
  ]
};
```

Patterns are added to `.omni/.gitignore` during sync, organized by capability.

### Sync Hook

Custom initialization logic that runs during `omnidev sync`:

```typescript
async function sync() {
  // Create required directories
  mkdirSync(".omni/mycap", { recursive: true });

  // Create default config if not exists
  if (!existsSync(".omni/mycap/config.toml")) {
    await Bun.write(".omni/mycap/config.toml", defaultConfig);
  }

  // Other initialization tasks
}

export default {
  sync
};
```

**Sync hook use cases:**
- Create directory structure
- Generate default configuration
- Initialize databases or caches
- Validate prerequisites

## Complete Example

### Example 1: Static Files Approach

Directory structure:
```
capabilities/deploy/
├── capability.toml
├── index.ts
├── cli.ts
├── sync.ts
├── docs/
│   └── deployment-guide.md
├── rules/
│   └── deployment-checklist.md
└── skills/
    └── deploy/
        ├── SKILL.md
        └── deploy-script.sh
```

**index.ts:**
```typescript
// Import types from @omnidev/core for type checking
import type { CapabilityExport } from "@omnidev/core";

// Import your capability's CLI commands and sync hook
import { deployRoutes } from "./cli.js";
import { sync } from "./sync.js";

// Export using static files approach
export default {
  cliCommands: {
    deploy: deployRoutes
  },

  // Docs, rules, skills auto-discovered from directories
  // No need to list them here!

  gitignore: [
    "deploy/logs/",
    "*.deploy.tmp"
  ],

  sync
} satisfies CapabilityExport;  // Type safety!

// Optional: Export functions for programmatic usage
export { getDeploymentStatus } from "./api.js";
```

### Example 2: Programmatic Approach

**index.ts:**
```typescript
import { buildRouteMap, buildCommand } from "@stricli/core";
import type { CapabilityExport } from "@omnidev/core";

// Generate everything programmatically
const deployCommand = buildCommand({
  func: async () => {
    console.log("Deploying...");
  },
  parameters: {},
  docs: { brief: "Deploy to production" }
});

const deployRoutes = buildRouteMap({
  routes: { run: deployCommand },
  docs: { brief: "Deployment commands" }
});

async function sync() {
  mkdirSync(".omni/deploy", { recursive: true });
}

export default {
  cliCommands: {
    deploy: deployRoutes
  },

  docs: [
    {
      title: "Deployment Guide",
      content: "# Deployment\n\nFollow these steps to deploy..."
    }
  ],

  rules: [
    `# Deployment Checklist

Before deploying:
- [ ] All tests pass
- [ ] Code reviewed
- [ ] Changelog updated`
  ],

  skills: [
    {
      skillMd: `---
name: deploy
description: "Deploy to production"
---

# Deploy Skill

Run deployment process...`,
      references: [
        {
          name: "deploy-script.sh",
          content: "#!/bin/bash\necho 'Deploying...'"
        }
      ]
    }
  ],

  gitignore: [
    "deploy/logs/",
    "*.deploy.tmp"
  ],

  sync
} satisfies CapabilityExport;
```

### Example 3: Hybrid Approach (Best of Both)

```typescript
import { deployRoutes } from "./cli.js";
import { sync } from "./sync.js";
import type { CapabilityExport } from "@omnidev/core";

export default {
  cliCommands: {
    deploy: deployRoutes
  },

  // Some rules from static files (rules/*.md)
  // Plus one generated dynamically:
  rules: [
    `# Dynamic Rule

This rule is generated based on the current environment...`
  ],

  // Skills from static files (skills/**/SKILL.md)
  // Plus one generated dynamically for a specific deployment target:
  skills: [
    {
      skillMd: generateDeploySkill(process.env.DEPLOY_TARGET),
      references: [
        {
          name: "target-config.json",
          content: JSON.stringify(getTargetConfig(), null, 2)
        }
      ]
    }
  ],

  gitignore: [
    "deploy/logs/",
    "*.deploy.tmp"
  ],

  sync
} satisfies CapabilityExport;

function generateDeploySkill(target: string): string {
  return `---
name: deploy-${target}
description: "Deploy to ${target}"
---

# Deploy to ${target}

...`;
}
```

## Best Practices

### Naming Conventions

- **Capability ID**: Use kebab-case (`my-capability`)
- **CLI commands**: Use lowercase (`deploy`, `task`)
- **MCP tools**: Use snake_case (`deploy_status`)
- **Files**: Use kebab-case (`deployment-guide.md`)

### File Organization

- Keep CLI commands in separate `cli.ts` file
- Keep MCP tools in separate `mcp.ts` file
- Group related rules in subdirectories
- Use descriptive names for skill directories

### Type Safety

Always use `satisfies CapabilityExport` to ensure type safety:

```typescript
export default {
  cliCommands: { /* ... */ }
} satisfies CapabilityExport;
```

This catches errors at build time instead of runtime.

### Testing

Test your capability before publishing:

```bash
# Enable capability
omnidev capability enable my-capability

# Sync to register everything
omnidev sync

# Test CLI commands
omnidev mycap --help

# Verify files were created
ls -la .omni/instructions.md
ls -la .claude/skills/
```

## Migration Guide

### Converting Old Capabilities

If you have an existing capability, update it to use structured exports:

**Before:**
```typescript
// Old pattern - individual exports
export { myRoutes } from "./cli.js";
export { sync } from "./sync.js";
export * from "./api.js";
```

**After:**
```typescript
// New pattern - structured default export
import { myRoutes } from "./cli.js";
import { sync } from "./sync.js";

export default {
  cliCommands: { mycap: myRoutes },
  rules: ["rules/guidelines.md"],
  sync
} satisfies CapabilityExport;

// Named exports still work for API
export * from "./api.js";
```

## TypeScript Reference

### CapabilityExport Interface

```typescript
interface CapabilityExport {
  /** CLI commands provided by this capability */
  cliCommands?: Record<string, Command>;

  /** MCP tools provided by this capability */
  mcpTools?: Record<string, McpToolExport>;

  /** Documentation (programmatic - optional, can also use docs/ directory) */
  docs?: DocExport[];

  /** Rules (programmatic - optional, can also use rules/ directory) */
  rules?: string[];  // Array of markdown content strings

  /** Skills (programmatic - optional, can also use skills/ directory) */
  skills?: SkillExport[];

  /** Gitignore patterns */
  gitignore?: string[];

  /** Custom sync hook function */
  sync?: () => Promise<void>;

  /** Allow additional custom exports */
  [key: string]: unknown;
}
```

### DocExport Interface

```typescript
interface DocExport {
  /** Document title */
  title: string;

  /** Markdown content */
  content: string;
}
```

### SkillExport Interface

```typescript
interface SkillExport {
  /** SKILL.md content (markdown with YAML frontmatter) */
  skillMd: string;

  /** Optional: Reference files to create (files the skill needs access to) */
  references?: FileContent[];

  /** Optional: Additional files to create (templates, examples, etc.) */
  additionalFiles?: FileContent[];
}
```

### FileContent Interface

```typescript
interface FileContent {
  /** File name (relative path within capability) */
  name: string;

  /** File content */
  content: string;
}
```

### McpToolExport Interface

**TODO**: Define complete MCP tool interface following MCP protocol specification.

## FAQ

### Q: Should I use static files or programmatic exports?

**Use static files** for:
- Simple, hand-written content
- Documentation and guides
- Rules that don't change often

**Use programmatic exports** for:
- Dynamically generated content
- Template-based content
- Content that depends on configuration

**Use both** when you need flexibility!

### Q: Can I export multiple CLI commands?

Yes! Just add multiple entries to `cliCommands`:

```typescript
export default {
  cliCommands: {
    deploy: deployRoutes,
    rollback: rollbackRoutes,
    status: statusRoutes
  }
};
```

### Q: Do I need to list all my static files in the export?

No! Static files in `docs/`, `rules/`, and `skills/` directories are automatically discovered. You only need to export programmatically generated content.

### Q: What if I have both static files and programmatic exports for the same type?

They are merged! For example, if you have `rules/checklist.md` AND export programmatic rules, both will be included in the final output.

### Q: Can I have both default export and named exports?

Yes! The default export is for OmniDev's capability system. Named exports can be used for programmatic API access:

```typescript
// Default export for OmniDev
export default {
  cliCommands: { /* ... */ }
} satisfies CapabilityExport;

// Named exports for programmatic usage
export { myFunction, myClass } from "./api.js";
```

### Q: What happens if I don't export certain fields?

All fields in `CapabilityExport` are optional. Only export what your capability provides. If you don't provide CLI commands, your capability simply won't register any commands.

### Q: How do I debug capability loading?

1. Check that `index.ts` has a default export (if using programmatic approach)
2. Verify the export structure with TypeScript: `satisfies CapabilityExport`
3. Run `omnidev sync` and check for error messages
4. Check that static files are in the correct directories (`docs/`, `rules/`, `skills/`)
5. Look for warnings about missing or invalid exports

## Need Help?

- Check examples in `capabilities/` directory
- Review the Ralph capability for a complete implementation
- Open an issue on GitHub for questions
