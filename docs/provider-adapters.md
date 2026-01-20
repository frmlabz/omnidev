# Provider Adapters

## Overview

OmniDev uses a **Provider Adapter** architecture to support multiple AI coding tools while keeping the core system provider-agnostic. This allows you to:

- Use OmniDev with any supported AI tool (Cursor, Claude Code, Codex, OpenCode)
- Switch between tools without reconfiguring capabilities
- Enable multiple tools simultaneously
- Keep provider preferences local (not committed to git)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Core                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Capability │───▶│ SyncBundle  │───▶│   Writers   │      │
│  │   Registry  │    │  (agnostic) │    │  (shared)   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ Claude Code │  │   Cursor    │  │    Codex    │
     │   Adapter   │  │   Adapter   │  │   Adapter   │
     └─────────────┘  └─────────────┘  └─────────────┘
              │               │               │
              ▼               ▼               ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ CLAUDE.md   │  │  .cursor/   │  │ AGENTS.md   │
     │ .claude/    │  │   rules/    │  │             │
     └─────────────┘  └─────────────┘  └─────────────┘
```

### How It Works

1. **Core builds a SyncBundle** - A provider-agnostic bundle containing all capabilities, skills, rules, docs, commands, and subagents.

2. **Adapters declare writers** - Each adapter specifies which file writers it needs and their output paths.

3. **Writers are deduplicated** - If multiple adapters request the same writer with the same output path, it only executes once.

4. **Writers materialize files** - Each writer receives the bundle and writes provider-specific files to disk.

5. **Provider state is local** - Enabled providers are stored in `.omni/state/providers.json`, which is gitignored. This allows team members to use different tools.

## Supported Providers

| Provider | ID | Files Written | Description |
|----------|-----|---------------|-------------|
| Claude Code | `claude-code` | `CLAUDE.md`, `.claude/skills/`, `.claude/settings.json` | The Claude CLI tool |
| Cursor | `cursor` | `CLAUDE.md`, `.claude/skills/`, `.cursor/rules/` | Cursor IDE |
| Codex | `codex` | `AGENTS.md`, `.codex/skills/` | GitHub Codex |
| OpenCode | `opencode` | `AGENTS.md`, `.opencode/skills/` | Open-source alternative |

## CLI Commands

### List Providers

```bash
omnidev provider list
```

Shows all available providers and their enabled status:

```
Available providers:

  ● Claude Code (claude-code)
  ○ Cursor (cursor)
  ○ Codex (codex)
  ○ OpenCode (opencode)

Legend: ● enabled, ○ disabled
```

### Enable a Provider

```bash
omnidev provider enable <provider-id>
```

Example:
```bash
omnidev provider enable cursor
```

This:
1. Adds the provider to your local state
2. Runs sync to write provider-specific files

### Disable a Provider

```bash
omnidev provider disable <provider-id>
```

Example:
```bash
omnidev provider disable codex
```

## Initialization

When you run `omnidev init`, you can specify which providers to enable:

```bash
# Enable a single provider
omnidev init claude-code

# Enable multiple providers
omnidev init claude-code,cursor

# Legacy shorthand (maps to claude-code and cursor)
omnidev init both
```

If you don't specify a provider, you'll be prompted to select from a list.

## Provider State

Provider preferences are stored in `.omni/state/providers.json`:

```json
{
  "enabled": ["claude-code", "cursor"]
}
```

This file is:
- **Gitignored** - Not committed to version control
- **User-specific** - Each team member can use different tools
- **Managed by CLI** - Use `omnidev provider` commands to modify

## What Each Adapter Writes

### Claude Code (`claude-code`)

**Writers:**
- `InstructionsMdWriter` → `CLAUDE.md` - Instructions from `OMNI.md` + capabilities
- `SkillsWriter` → `.claude/skills/` - Skills as `<skill-name>/SKILL.md`
- `HooksWriter` → `.claude/settings.json` - Lifecycle hooks

### Cursor (`cursor`)

**Init:**
- Creates `.cursor/rules/` directory

**Writers:**
- `InstructionsMdWriter` → `CLAUDE.md` - Instructions from `OMNI.md` + capabilities
- `SkillsWriter` → `.claude/skills/` - Skills as `<skill-name>/SKILL.md`
- `CursorRulesWriter` → `.cursor/rules/` - Rules as `omnidev-<rule-name>.mdc`

### Codex (`codex`)

**Init:**
- Creates `.codex/` directory

**Writers:**
- `InstructionsMdWriter` → `AGENTS.md` - Instructions from `OMNI.md` + capabilities
- `SkillsWriter` → `.codex/skills/` - Skills as `<skill-name>/SKILL.md`

### OpenCode (`opencode`)

**Init:**
- Creates `.opencode/` directory

**Writers:**
- `InstructionsMdWriter` → `AGENTS.md` - Instructions from `OMNI.md` + capabilities
- `SkillsWriter` → `.opencode/skills/` - Skills as `<skill-name>/SKILL.md`

## File Writers

Adapters use **File Writers** to write content to disk. Writers are stateless and can be shared across adapters. The same writer can be used with different output paths.

### Available Writers

| Writer | ID | Description |
|--------|-----|-------------|
| `InstructionsMdWriter` | `instructions-md` | Writes instructions markdown (CLAUDE.md, AGENTS.md, etc.) |
| `SkillsWriter` | `skills` | Writes skills to a directory structure |
| `HooksWriter` | `hooks` | Writes hooks to settings.json |
| `CursorRulesWriter` | `cursor-rules` | Writes rules as .mdc files |

### Deduplication

Writers are deduplicated by `(writer.id + outputPath)`. If two adapters both request:
- `InstructionsMdWriter` → `AGENTS.md`

The writer only executes once, preventing conflicts and duplicate writes.

### Writer Interface

```typescript
interface FileWriter {
  readonly id: string;
  write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult>;
}

interface WriterContext {
  outputPath: string;
  projectRoot: string;
}
```

## Provider-Agnostic Files

Regardless of which providers are enabled, OmniDev always writes these files:

| File | Description |
|------|-------------|
| `.omni/.gitignore` | Capability-specific ignore patterns |
| `.omni/state/manifest.json` | Resource tracking for cleanup |
| `.mcp.json` | MCP server configurations |

## Developing Custom Adapters

Adapters are defined in `@omnidev-ai/adapters`:

```typescript
import type { ProviderAdapter } from "@omnidev-ai/core";
import { InstructionsMdWriter, SkillsWriter, type AdapterWriterConfig } from "@omnidev-ai/adapters";

export const myAdapter: ProviderAdapter & { writers: AdapterWriterConfig[] } = {
  id: "my-tool",
  displayName: "My Tool",

  // Declare which writers this adapter needs
  writers: [
    { writer: InstructionsMdWriter, outputPath: "MY_TOOL.md" },
    { writer: SkillsWriter, outputPath: ".my-tool/skills/" },
  ],

  async init(ctx) {
    // Create initial directories/files
    return { filesCreated: [".my-tool/"] };
  },

  async sync(bundle, ctx) {
    // Writers handle the actual file writing
    const result = await executeWriters(this.writers, bundle, ctx.projectRoot);
    return { filesWritten: result.filesWritten, filesDeleted: [] };
  },
};
```

### Creating Custom Writers

```typescript
import type { FileWriter, WriterContext, WriterResult } from "@omnidev-ai/adapters";
import type { SyncBundle } from "@omnidev-ai/core";

export const MyCustomWriter: FileWriter = {
  id: "my-custom-writer",

  async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
    // Write files based on bundle content
    const outputPath = join(ctx.projectRoot, ctx.outputPath);

    // ... write your files ...

    return {
      filesWritten: [ctx.outputPath],
    };
  },
};
```

### SyncBundle Contents

```typescript
interface SyncBundle {
  capabilities: LoadedCapability[];
  skills: Skill[];
  rules: Rule[];
  docs: Doc[];
  commands: Command[];
  subagents: Subagent[];
  hooks?: HooksConfig;
  instructionsContent: string;   // Generated content to embed directly
}
```

## FAQ

### Q: Can I use multiple providers at once?

Yes! Enable multiple providers and they'll all receive the sync bundle:

```bash
omnidev provider enable claude-code
omnidev provider enable cursor
```

### Q: What happens if two providers write the same file?

Writers are deduplicated by `(writer.id + outputPath)`. If two adapters both want to write the same file with the same writer, it only executes once. This prevents conflicts and ensures consistent output.

### Q: How do I migrate from one provider to another?

1. Enable the new provider: `omnidev provider enable <new>`
2. Run sync: `omnidev sync`
3. Optionally disable the old provider: `omnidev provider disable <old>`

### Q: Why are provider preferences local?

Different team members may use different AI tools. Keeping this setting local allows:
- Team members to use their preferred tool
- CI/CD to enable specific providers for automation
- No conflicts in committed configuration

### Q: How do I set default providers for a new project?

The `omnidev init` command prompts for provider selection or accepts them as arguments:

```bash
# For teams standardizing on Claude Code
omnidev init claude-code

# For teams using multiple tools
omnidev init claude-code,cursor,codex
```

