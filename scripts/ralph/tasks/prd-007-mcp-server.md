# PRD-007: MCP Server Package

**Status:** Ready  
**Priority:** 7 (MCP - After CLI package)  
**Estimated Effort:** Large

---

## Introduction / Overview

Implement the MCP (Model Context Protocol) server package for OmniDev. The MCP server exposes exactly two tools to LLMs: `omni_query` for discovery/search and `omni_execute` for running TypeScript code in the sandbox. This is the core interface through which AI agents interact with OmniDev.

---

## Goals

- Set up MCP server using `@modelcontextprotocol/sdk`
- Implement `omni_query` tool for searching capabilities, docs, and skills
- Implement `omni_execute` tool for running TypeScript code
- Set up the sandbox environment for code execution
- Implement hot reload on configuration changes
- Support stdio transport for MCP communication

---

## User Stories

### US-001: Set Up MCP Server Framework

**Description:** As a developer, I need the MCP server configured so that AI agents can connect.

**Acceptance Criteria:**
- [ ] `@modelcontextprotocol/sdk` is installed
- [ ] MCP server is created in `src/server.ts`
- [ ] Server uses stdio transport
- [ ] Server starts and accepts connections
- [ ] Typecheck passes

---

### US-002: Implement `omni_query` Tool

**Description:** As an AI agent, I need to query capabilities and docs so that I know what's available.

**Acceptance Criteria:**
- [ ] `omni_query` is registered as an MCP tool
- [ ] Accepts `query` (string), `limit` (number), `include_types` (boolean)
- [ ] Searches across capabilities, skills, docs
- [ ] Returns matching snippets with source tags
- [ ] Returns type definitions when `include_types` is true
- [ ] Returns summary when query is empty
- [ ] Tests cover query scenarios
- [ ] Typecheck passes

---

### US-003: Implement `omni_execute` Tool

**Description:** As an AI agent, I need to execute TypeScript code so that I can perform actions.

**Acceptance Criteria:**
- [ ] `omni_execute` is registered as an MCP tool
- [ ] Accepts `code` (string) containing TypeScript
- [ ] Writes code to `.omni/sandbox/main.ts`
- [ ] Executes using `bun run`
- [ ] Returns stdout, stderr, exit_code
- [ ] Returns changed_files and diff_stat
- [ ] Tests cover execution scenarios
- [ ] Typecheck passes

---

### US-004: Set Up Sandbox Environment

**Description:** As a developer, I need the sandbox configured so that capabilities are importable.

**Acceptance Criteria:**
- [ ] `.omni/sandbox/` directory is created
- [ ] Symlinks to enabled capabilities in `sandbox/node_modules/`
- [ ] Sandbox can import capability modules by name
- [ ] Sandbox runs with repo root as working directory
- [ ] Tests cover sandbox setup
- [ ] Typecheck passes

---

### US-005: Implement Hot Reload

**Description:** As a developer, I need the server to reload when config changes so that I don't have to restart.

**Acceptance Criteria:**
- [ ] Server watches `omni/config.toml` for changes
- [ ] Server watches `.omni/active-profile` for changes
- [ ] Server watches `omni/capabilities/` for changes
- [ ] Server reloads capabilities on changes
- [ ] Logs when reload occurs
- [ ] Tests cover reload scenarios
- [ ] Typecheck passes

---

### US-006: Implement Server Lifecycle

**Description:** As a developer, I need proper server lifecycle management so that the server runs reliably.

**Acceptance Criteria:**
- [ ] Writes PID to `.omni/server.pid` on start
- [ ] Removes PID file on shutdown
- [ ] Handles SIGINT and SIGTERM gracefully
- [ ] Logs server start and stop events
- [ ] Tests cover lifecycle scenarios
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** MCP server must use stdio transport
- **FR-2:** `omni_query` must search across all enabled capabilities
- **FR-3:** `omni_execute` must run TypeScript via Bun
- **FR-4:** Sandbox must have access to enabled capability modules
- **FR-5:** Server must reload on config/capability changes
- **FR-6:** All tool responses must be valid JSON
- **FR-7:** Errors must be caught and returned as tool responses, not server crashes

---

## Non-Goals (Out of Scope)

- ❌ No security sandboxing (local development tool)
- ❌ No git safety layer (checkpoints, rollback)
- ❌ No MCP server wrapping (future feature)
- ❌ No doc indexing/RAG (basic search only)

---

## Technical Considerations

### MCP Server (`packages/mcp/src/server.ts`)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { buildCapabilityRegistry } from '@omnidev/core';
import { handleOmniQuery } from './tools/query';
import { handleOmniExecute } from './tools/execute';
import { setupSandbox } from './sandbox';
import { startWatcher } from './watcher';

let registry = await buildCapabilityRegistry();

const server = new Server(
  {
    name: 'omnidev',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'omni_query',
        description: 'Search capabilities, docs, and skills. Returns type definitions when include_types is true.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query. Empty returns summary of enabled capabilities.',
            },
            limit: {
              type: 'number',
              description: 'Maximum results to return (default: 10)',
            },
            include_types: {
              type: 'boolean',
              description: 'Include TypeScript type definitions in response',
            },
          },
        },
      },
      {
        name: 'omni_execute',
        description: 'Execute TypeScript code in the sandbox with access to capability modules.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Full TypeScript file contents with export async function main(): Promise<number>',
            },
          },
          required: ['code'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'omni_query':
        return handleOmniQuery(registry, args);
      case 'omni_execute':
        return handleOmniExecute(registry, args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
export async function startServer() {
  // Setup sandbox symlinks
  await setupSandbox(registry.getAllCapabilities());

  // Write PID file
  await Bun.write('.omni/server.pid', process.pid.toString());

  // Start file watcher for hot reload
  startWatcher(async () => {
    console.error('[omnidev] Reloading capabilities...');
    registry = await buildCapabilityRegistry();
    await setupSandbox(registry.getAllCapabilities());
  });

  // Handle shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[omnidev] MCP server started');
}

async function shutdown() {
  console.error('[omnidev] Shutting down...');
  try {
    await Bun.file('.omni/server.pid').delete();
  } catch {
    // Ignore
  }
  process.exit(0);
}
```

### Query Tool (`packages/mcp/src/tools/query.ts`)

```typescript
import type { CapabilityRegistry } from '@omnidev/core';

interface QueryArgs {
  query?: string;
  limit?: number;
  include_types?: boolean;
}

export async function handleOmniQuery(
  registry: CapabilityRegistry,
  args: QueryArgs
) {
  const { query = '', limit = 10, include_types = false } = args;

  const results: string[] = [];

  // If no query, return summary
  if (!query.trim()) {
    const capabilities = registry.getAllCapabilities();
    results.push(`Enabled capabilities (${capabilities.length}):`);
    for (const cap of capabilities) {
      results.push(`  - ${cap.id}: ${cap.config.capability.description}`);
    }
  } else {
    // Search capabilities, skills, docs
    const queryLower = query.toLowerCase();

    // Search capabilities
    for (const cap of registry.getAllCapabilities()) {
      if (
        cap.id.toLowerCase().includes(queryLower) ||
        cap.config.capability.description.toLowerCase().includes(queryLower)
      ) {
        results.push(`[capability:${cap.id}] ${cap.config.capability.description}`);
      }
    }

    // Search skills
    for (const skill of registry.getAllSkills()) {
      if (
        skill.name.toLowerCase().includes(queryLower) ||
        skill.description.toLowerCase().includes(queryLower)
      ) {
        results.push(`[skill:${skill.capabilityId}/${skill.name}] ${skill.description}`);
      }
    }

    // Search docs
    for (const doc of registry.getAllDocs()) {
      if (
        doc.name.toLowerCase().includes(queryLower) ||
        doc.content.toLowerCase().includes(queryLower)
      ) {
        const snippet = doc.content.slice(0, 100).replace(/\n/g, ' ');
        results.push(`[doc:${doc.capabilityId}/${doc.name}] ${snippet}...`);
      }
    }
  }

  // Add type definitions if requested
  let typeDefinitions = '';
  if (include_types || !query.trim()) {
    typeDefinitions = generateTypeDefinitions(registry);
  }

  const limitedResults = results.slice(0, limit);
  let response = limitedResults.join('\n');

  if (typeDefinitions) {
    response += '\n\n--- Type Definitions ---\n\n' + typeDefinitions;
  }

  return {
    content: [
      {
        type: 'text',
        text: response,
      },
    ],
  };
}

function generateTypeDefinitions(registry: CapabilityRegistry): string {
  let dts = '// Auto-generated type definitions for enabled capabilities\n\n';

  for (const cap of registry.getAllCapabilities()) {
    const moduleName = cap.config.exports?.module ?? cap.id;
    dts += `declare module '${moduleName}' {\n`;
    
    if (cap.typeDefinitions) {
      // Indent each line
      const indented = cap.typeDefinitions
        .split('\n')
        .map(line => '  ' + line)
        .join('\n');
      dts += indented;
    } else {
      dts += `  // No type definitions available\n`;
    }
    
    dts += `\n}\n\n`;
  }

  return dts;
}
```

### Execute Tool (`packages/mcp/src/tools/execute.ts`)

```typescript
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import type { CapabilityRegistry } from '@omnidev/core';

interface ExecuteArgs {
  code: string;
}

interface ExecuteResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  changed_files: string[];
  diff_stat: { files: number; insertions: number; deletions: number };
}

export async function handleOmniExecute(
  registry: CapabilityRegistry,
  args: ExecuteArgs
) {
  const { code } = args;

  if (!code) {
    throw new Error('code is required');
  }

  // Write code to sandbox
  mkdirSync('.omni/sandbox', { recursive: true });
  await Bun.write('.omni/sandbox/main.ts', code);

  // Execute with Bun
  const result = await executeCode();

  // Get git diff stats
  const diffStat = await getGitDiffStats();

  const response: ExecuteResult = {
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    changed_files: diffStat.files,
    diff_stat: {
      files: diffStat.files.length,
      insertions: diffStat.insertions,
      deletions: diffStat.deletions,
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

async function executeCode(): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', '.omni/sandbox/main.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Add sandbox-specific env if needed
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function getGitDiffStats(): Promise<{
  files: string[];
  insertions: number;
  deletions: number;
}> {
  try {
    const proc = Bun.spawn(['git', 'diff', '--stat', '--name-only']);
    const output = await new Response(proc.stdout).text();
    
    const files = output.trim().split('\n').filter(Boolean);
    
    // Get numeric stats
    const statProc = Bun.spawn(['git', 'diff', '--shortstat']);
    const statOutput = await new Response(statProc.stdout).text();
    
    const insertMatch = statOutput.match(/(\d+) insertion/);
    const deleteMatch = statOutput.match(/(\d+) deletion/);

    return {
      files,
      insertions: insertMatch ? parseInt(insertMatch[1], 10) : 0,
      deletions: deleteMatch ? parseInt(deleteMatch[1], 10) : 0,
    };
  } catch {
    return { files: [], insertions: 0, deletions: 0 };
  }
}
```

### Sandbox Setup (`packages/mcp/src/sandbox.ts`)

```typescript
import { symlink, mkdir, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { LoadedCapability } from '@omnidev/core';

const SANDBOX_DIR = '.omni/sandbox';
const SANDBOX_NODE_MODULES = '.omni/sandbox/node_modules';

export async function setupSandbox(
  capabilities: LoadedCapability[]
): Promise<void> {
  // Create sandbox directory
  await mkdir(SANDBOX_DIR, { recursive: true });
  await mkdir(SANDBOX_NODE_MODULES, { recursive: true });

  // Clean existing symlinks
  if (existsSync(SANDBOX_NODE_MODULES)) {
    const entries = await readdir(SANDBOX_NODE_MODULES);
    for (const entry of entries) {
      await unlink(join(SANDBOX_NODE_MODULES, entry)).catch(() => {});
    }
  }

  // Create symlinks for each capability
  for (const cap of capabilities) {
    const moduleName = cap.config.exports?.module ?? cap.id;
    const linkPath = join(SANDBOX_NODE_MODULES, moduleName);
    const targetPath = join('../../..', cap.path);

    try {
      await symlink(targetPath, linkPath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
        console.error(`Failed to symlink ${moduleName}:`, e);
      }
    }
  }
}
```

### File Watcher (`packages/mcp/src/watcher.ts`)

```typescript
import { watch } from 'fs';

const WATCH_PATHS = [
  'omni/config.toml',
  '.omni/config.local.toml',
  '.omni/active-profile',
  'omni/capabilities/',
];

export function startWatcher(onReload: () => Promise<void>) {
  let debounceTimer: Timer | null = null;

  const handleChange = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      await onReload();
    }, 500);
  };

  for (const path of WATCH_PATHS) {
    try {
      watch(path, { recursive: true }, (event, filename) => {
        console.error(`[omnidev] Change detected: ${filename}`);
        handleChange();
      });
    } catch (e) {
      // Path may not exist yet
      console.error(`[omnidev] Warning: Cannot watch ${path}`);
    }
  }
}
```

### Directory Structure

```
packages/mcp/src/
├── index.ts              # Package entry point
├── server.ts             # MCP server setup
├── sandbox.ts            # Sandbox setup
├── watcher.ts            # File watching
└── tools/
    ├── query.ts          # omni_query implementation
    └── execute.ts        # omni_execute implementation
```

---

## Touchpoints

Files to create or modify:

### MCP Package
- `packages/mcp/src/index.ts` - Package entry (CREATE)
- `packages/mcp/src/server.ts` - MCP server (CREATE)
- `packages/mcp/src/sandbox.ts` - Sandbox setup (CREATE)
- `packages/mcp/src/watcher.ts` - File watching (CREATE)
- `packages/mcp/src/tools/query.ts` - Query tool (CREATE)
- `packages/mcp/src/tools/execute.ts` - Execute tool (CREATE)
- `packages/mcp/package.json` - Add dependencies (MODIFY)

### Tests
- `packages/mcp/src/tools/query.test.ts` (CREATE)
- `packages/mcp/src/tools/execute.test.ts` (CREATE)
- `packages/mcp/src/sandbox.test.ts` (CREATE)

---

## Dependencies

- ✅ PRD-001: Bun Monorepo Setup
- ✅ PRD-002: Code Quality Infrastructure
- ✅ PRD-003: Testing Infrastructure
- ✅ PRD-004: Core Types and Config
- ✅ PRD-005: Capability System
- `@modelcontextprotocol/sdk`: MCP SDK (to be installed)

---

## Success Metrics

- MCP server starts and accepts connections
- `omni_query` returns relevant search results
- `omni_execute` runs TypeScript code successfully
- Sandbox symlinks work correctly
- Hot reload triggers on config changes
- 70%+ test coverage on tool handlers

---

## Implementation Notes

### Suggested Implementation Order

1. **Install MCP SDK** - add dependency
2. **Create server.ts** - basic MCP server
3. **Implement omni_query** - search functionality
4. **Set up sandbox** - symlink capabilities
5. **Implement omni_execute** - code execution
6. **Add file watcher** - hot reload
7. **Add lifecycle management** - PID file, shutdown
8. **Write tests** - comprehensive coverage

### Testing MCP Server

```bash
# Start server manually
bun run packages/mcp/src/index.ts

# Test with MCP inspector or client
# The server uses stdio, so pipe input/output

# Run tests
bun test packages/mcp
```

---

## Codebase Patterns

Ralph should follow these patterns:

- Use MCP SDK's Server class for the server
- Use stdio transport for communication
- Log to stderr (stdout is for MCP protocol)
- Return errors as tool responses, don't crash
- Use Bun.spawn for subprocess execution

---

