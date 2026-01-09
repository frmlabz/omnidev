# PRD-006: CLI Package

**Status:** Ready  
**Priority:** 6 (CLI - After core package)  
**Estimated Effort:** Large

---

## Introduction / Overview

Implement the CLI package for OmniDev using Stricli, a type-safe CLI framework. The CLI provides commands for initializing projects, managing capabilities, syncing agent configs, managing profiles, and running the MCP server. This is the primary interface for developers using OmniDev.

---

## Goals

- Set up Stricli CLI framework in the CLI package
- Implement core commands: init, doctor, serve
- Implement capability commands: list, enable, disable
- Implement profile commands: list, set
- Implement agents sync command for multi-provider support
- Implement types generate command
- Support capability-contributed commands (extensibility)

---

## User Stories

### US-001: Set Up Stricli CLI Framework

**Description:** As a developer, I need the CLI framework configured so that commands can be added.

**Acceptance Criteria:**
- [ ] `@stricli/core` is installed as a dependency
- [ ] CLI application is bootstrapped in `src/app.ts`
- [ ] Entry point in `src/index.ts` runs the CLI
- [ ] `bun run packages/cli/src/index.ts --help` shows help
- [ ] Typecheck passes

---

### US-002: Implement `omnidev init` Command

**Description:** As a developer, I need an init command so that I can set up OmniDev in a new project.

**Acceptance Criteria:**
- [ ] Creates `omni/` directory with `config.toml`
- [ ] Creates `.omni/` directory (gitignored)
- [ ] Creates `agents.md` reference file
- [ ] Creates `.claude/claude.md` reference file
- [ ] Updates `.gitignore` with OmniDev entries
- [ ] Shows success message with next steps
- [ ] Tests cover init scenarios
- [ ] Typecheck passes

---

### US-003: Implement `omnidev doctor` Command

**Description:** As a developer, I need a doctor command so that I can verify my setup is correct.

**Acceptance Criteria:**
- [ ] Checks Bun version (requires 1.0+)
- [ ] Checks if `omni/` directory exists
- [ ] Checks if `.omni/` directory exists
- [ ] Checks if config.toml is valid
- [ ] Reports status of each check (✓ or ✗)
- [ ] Suggests fixes for failed checks
- [ ] Tests cover doctor scenarios
- [ ] Typecheck passes

---

### US-004: Implement `omnidev capability list` Command

**Description:** As a developer, I need to list capabilities so that I can see what's available.

**Acceptance Criteria:**
- [ ] Lists all discovered capabilities
- [ ] Shows enabled/disabled status
- [ ] Shows capability name, id, and version
- [ ] Handles no capabilities gracefully
- [ ] Tests cover list scenarios
- [ ] Typecheck passes

---

### US-005: Implement `omnidev profile list` Command

**Description:** As a developer, I need to list profiles so that I can see available configurations.

**Acceptance Criteria:**
- [ ] Lists all defined profiles from config
- [ ] Shows which profile is currently active
- [ ] Shows capabilities in each profile
- [ ] Handles no profiles gracefully
- [ ] Tests cover profile list scenarios
- [ ] Typecheck passes

---

### US-006: Implement `omnidev profile set` Command

**Description:** As a developer, I need to switch profiles so that I can change active capabilities.

**Acceptance Criteria:**
- [ ] Validates profile exists in config
- [ ] Writes profile name to `.omni/active-profile`
- [ ] Triggers `agents sync` automatically
- [ ] Shows confirmation message
- [ ] Tests cover profile set scenarios
- [ ] Typecheck passes

---

### US-007: Implement `omnidev agents sync` Command

**Description:** As a developer, I need to sync agent configs so that AI providers have the right context.

**Acceptance Criteria:**
- [ ] Collects skills and rules from enabled capabilities
- [ ] Generates `.omni/generated/rules.md`
- [ ] Generates `.omni/generated/types.d.ts`
- [ ] Writes skills to `.claude/skills/` (gitignored)
- [ ] Writes rules to `.cursor/rules/omnidev-*.mdc` (gitignored)
- [ ] Shows list of generated files
- [ ] Tests cover sync scenarios
- [ ] Typecheck passes

---

### US-008: Implement `omnidev types generate` Command

**Description:** As a developer, I need to generate type definitions so that LLMs can write correct code.

**Acceptance Criteria:**
- [ ] Collects type definitions from enabled capabilities
- [ ] Generates `.omni/generated/types.d.ts`
- [ ] Includes all exported functions and types
- [ ] Shows success message with file path
- [ ] Tests cover type generation
- [ ] Typecheck passes

---

### US-009: Implement `omnidev serve` Command

**Description:** As a developer, I need to start the MCP server so that AI agents can connect.

**Acceptance Criteria:**
- [ ] Starts MCP server from `@omnidev/mcp` package
- [ ] Accepts `--profile` flag to set active profile
- [ ] Writes PID to `.omni/server.pid`
- [ ] Shows server status messages
- [ ] Handles graceful shutdown on SIGINT/SIGTERM
- [ ] Tests cover serve scenarios
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** CLI must use Stricli framework with type-safe commands
- **FR-2:** All commands must have `--help` documentation
- **FR-3:** Init command must be idempotent (safe to run multiple times)
- **FR-4:** Profile set must automatically trigger agents sync
- **FR-5:** Agents sync must generate files for all providers
- **FR-6:** Error messages must be helpful and actionable
- **FR-7:** CLI must work with `bun run` and as compiled binary

---

## Non-Goals (Out of Scope)

- ❌ No interactive TUI views (OpenTUI) - future feature
- ❌ No capability-contributed commands - future feature
- ❌ No watch mode for file changes
- ❌ No capability install from hub

---

## Technical Considerations

### CLI Application (`packages/cli/src/app.ts`)

```typescript
import { buildApplication, buildCommand, buildRouteMap } from '@stricli/core';
import { initCommand } from './commands/init';
import { doctorCommand } from './commands/doctor';
import { serveCommand } from './commands/serve';
import { capabilityRoutes } from './commands/capability';
import { profileRoutes } from './commands/profile';
import { agentsRoutes } from './commands/agents';
import { typesRoutes } from './commands/types';

const app = buildApplication(
  buildRouteMap({
    routes: {
      init: initCommand,
      doctor: doctorCommand,
      serve: serveCommand,
      capability: capabilityRoutes,
      profile: profileRoutes,
      agents: agentsRoutes,
      types: typesRoutes,
    },
  }),
  {
    name: 'omnidev',
    versionInfo: {
      currentVersion: '0.1.0',
    },
  }
);

export { app };
```

### Entry Point (`packages/cli/src/index.ts`)

```typescript
import { run } from '@stricli/core';
import { app } from './app';

run(app, process.argv.slice(2));
```

### Init Command (`packages/cli/src/commands/init.ts`)

```typescript
import { buildCommand } from '@stricli/core';
import { existsSync, mkdirSync, appendFileSync } from 'fs';

export const initCommand = buildCommand({
  docs: {
    brief: 'Initialize OmniDev in the current project',
  },
  async func() {
    console.log('Initializing OmniDev...');

    // Create omni/ directory
    if (!existsSync('omni')) {
      mkdirSync('omni', { recursive: true });
      mkdirSync('omni/capabilities', { recursive: true });
    }

    // Create config.toml
    if (!existsSync('omni/config.toml')) {
      await Bun.write('omni/config.toml', defaultConfig());
    }

    // Create .omni/ directory
    if (!existsSync('.omni')) {
      mkdirSync('.omni', { recursive: true });
      mkdirSync('.omni/generated', { recursive: true });
      mkdirSync('.omni/state', { recursive: true });
      mkdirSync('.omni/sandbox', { recursive: true });
    }

    // Create reference files
    await createReferenceFiles();

    // Update .gitignore
    updateGitignore();

    console.log('✓ OmniDev initialized!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit omni/config.toml to configure capabilities');
    console.log('  2. Run: omnidev capability list');
    console.log('  3. Run: omnidev agents sync');
  },
});

function defaultConfig(): string {
  return `# OmniDev Configuration
project = "my-project"
default_profile = "default"

[capabilities]
enable = ["tasks"]
disable = []

[profiles.default]
# Default profile uses base capabilities

[profiles.planning]
enable = ["tasks"]
disable = []

[profiles.coding]
enable = ["tasks"]
disable = []
`;
}

async function createReferenceFiles() {
  // agents.md
  if (!existsSync('agents.md')) {
    await Bun.write('agents.md', `# Agent Configuration

> Managed by OmniDev. Do not edit directly.
> Run \`omnidev agents sync\` to regenerate.

See: .omni/generated/rules.md for current rules.
`);
  }

  // .claude/claude.md
  mkdirSync('.claude', { recursive: true });
  if (!existsSync('.claude/claude.md')) {
    await Bun.write('.claude/claude.md', `# Claude Code Configuration

> Managed by OmniDev.
> Skills are in \`.claude/skills/\` (gitignored, profile-dependent)
> Run \`omnidev agents sync\` to regenerate.

See: .omni/generated/rules.md for current rules.
`);
  }
}

function updateGitignore() {
  const gitignorePath = '.gitignore';
  const omnidevEntries = `
# OmniDev - local state and generated content
.omni/

# Provider-specific generated content (profile-dependent)
.claude/skills/
.cursor/rules/omnidev-*.mdc
`;

  if (existsSync(gitignorePath)) {
    const content = Bun.file(gitignorePath).text();
    if (!content.includes('.omni/')) {
      appendFileSync(gitignorePath, omnidevEntries);
    }
  } else {
    Bun.write(gitignorePath, omnidevEntries.trim());
  }
}
```

### Doctor Command (`packages/cli/src/commands/doctor.ts`)

```typescript
import { buildCommand } from '@stricli/core';
import { existsSync } from 'fs';

export const doctorCommand = buildCommand({
  docs: {
    brief: 'Check OmniDev setup and dependencies',
  },
  async func() {
    console.log('OmniDev Doctor');
    console.log('==============');
    console.log('');

    const checks = [
      checkBunVersion(),
      checkOmniDir(),
      checkOmniLocalDir(),
      checkConfig(),
    ];

    let allPassed = true;
    for (const check of checks) {
      const { name, passed, message, fix } = await check;
      const icon = passed ? '✓' : '✗';
      console.log(`${icon} ${name}: ${message}`);
      if (!passed && fix) {
        console.log(`  Fix: ${fix}`);
      }
      if (!passed) allPassed = false;
    }

    console.log('');
    if (allPassed) {
      console.log('All checks passed!');
    } else {
      console.log('Some checks failed. Please fix the issues above.');
      process.exit(1);
    }
  },
});

interface Check {
  name: string;
  passed: boolean;
  message: string;
  fix?: string;
}

async function checkBunVersion(): Promise<Check> {
  const version = Bun.version;
  const major = parseInt(version.split('.')[0], 10);
  
  return {
    name: 'Bun Version',
    passed: major >= 1,
    message: `v${version}`,
    fix: major < 1 ? 'Upgrade Bun: curl -fsSL https://bun.sh/install | bash' : undefined,
  };
}

async function checkOmniDir(): Promise<Check> {
  const exists = existsSync('omni');
  return {
    name: 'omni/ directory',
    passed: exists,
    message: exists ? 'Found' : 'Not found',
    fix: exists ? undefined : 'Run: omnidev init',
  };
}

async function checkOmniLocalDir(): Promise<Check> {
  const exists = existsSync('.omni');
  return {
    name: '.omni/ directory',
    passed: exists,
    message: exists ? 'Found' : 'Not found',
    fix: exists ? undefined : 'Run: omnidev init',
  };
}

async function checkConfig(): Promise<Check> {
  const configPath = 'omni/config.toml';
  if (!existsSync(configPath)) {
    return {
      name: 'Configuration',
      passed: false,
      message: 'config.toml not found',
      fix: 'Run: omnidev init',
    };
  }

  try {
    const { loadConfig } = await import('@omnidev/core');
    await loadConfig();
    return {
      name: 'Configuration',
      passed: true,
      message: 'Valid',
    };
  } catch (error) {
    return {
      name: 'Configuration',
      passed: false,
      message: `Invalid: ${error}`,
      fix: 'Check omni/config.toml syntax',
    };
  }
}
```

### Agents Sync Command (`packages/cli/src/commands/agents.ts`)

```typescript
import { buildCommand, buildRouteMap } from '@stricli/core';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const agentsRoutes = buildRouteMap({
  routes: {
    sync: buildCommand({
      docs: {
        brief: 'Sync agent configuration to all providers',
      },
      async func() {
        const { buildCapabilityRegistry } = await import('@omnidev/core');
        
        console.log('Syncing agent configuration...');
        
        const registry = await buildCapabilityRegistry();
        const skills = registry.getAllSkills();
        const rules = registry.getAllRules();

        // Ensure directories exist
        mkdirSync('.omni/generated', { recursive: true });
        mkdirSync('.claude/skills', { recursive: true });
        mkdirSync('.cursor/rules', { recursive: true });

        // Generate .omni/generated/rules.md
        const rulesContent = generateRulesMarkdown(rules);
        await Bun.write('.omni/generated/rules.md', rulesContent);

        // Write skills to .claude/skills/
        for (const skill of skills) {
          const skillDir = `.claude/skills/${skill.name}`;
          mkdirSync(skillDir, { recursive: true });
          await Bun.write(
            join(skillDir, 'SKILL.md'),
            `---
name: ${skill.name}
description: "${skill.description}"
---

${skill.instructions}`
          );
        }

        // Write rules to .cursor/rules/
        for (const rule of rules) {
          await Bun.write(
            `.cursor/rules/omnidev-${rule.name}.mdc`,
            rule.content
          );
        }

        console.log('✓ Generated:');
        console.log('  - .omni/generated/rules.md');
        console.log(`  - .claude/skills/ (${skills.length} skills)`);
        console.log(`  - .cursor/rules/ (${rules.length} rules)`);
      },
    }),
  },
});

function generateRulesMarkdown(rules: Rule[]): string {
  let content = `# Active Rules

> Generated by OmniDev
> Run \`omnidev agents sync\` to regenerate

`;

  for (const rule of rules) {
    content += `## ${rule.name} (from ${rule.capabilityId})

${rule.content}

---

`;
  }

  return content;
}
```

### Directory Structure

```
packages/cli/src/
├── index.ts                 # Entry point
├── app.ts                   # Stricli application
└── commands/
    ├── init.ts              # omnidev init
    ├── doctor.ts            # omnidev doctor
    ├── serve.ts             # omnidev serve
    ├── capability.ts        # omnidev capability list/enable/disable
    ├── profile.ts           # omnidev profile list/set
    ├── agents.ts            # omnidev agents sync
    └── types.ts             # omnidev types generate
```

---

## Touchpoints

Files to create or modify:

### CLI Package
- `packages/cli/src/index.ts` - Entry point (CREATE)
- `packages/cli/src/app.ts` - Application setup (CREATE)
- `packages/cli/src/commands/init.ts` - Init command (CREATE)
- `packages/cli/src/commands/doctor.ts` - Doctor command (CREATE)
- `packages/cli/src/commands/serve.ts` - Serve command (CREATE)
- `packages/cli/src/commands/capability.ts` - Capability commands (CREATE)
- `packages/cli/src/commands/profile.ts` - Profile commands (CREATE)
- `packages/cli/src/commands/agents.ts` - Agents commands (CREATE)
- `packages/cli/src/commands/types.ts` - Types commands (CREATE)
- `packages/cli/package.json` - Add dependencies (MODIFY)

### Tests
- `packages/cli/src/commands/*.test.ts` - Command tests (CREATE)

---

## Dependencies

- ✅ PRD-001: Bun Monorepo Setup
- ✅ PRD-002: Code Quality Infrastructure
- ✅ PRD-003: Testing Infrastructure
- ✅ PRD-004: Core Types and Config
- ✅ PRD-005: Capability System
- `@stricli/core`: CLI framework (to be installed)

---

## Success Metrics

- All commands have working `--help` output
- `omnidev init` creates correct directory structure
- `omnidev doctor` reports accurate status
- `omnidev agents sync` generates correct files
- `omnidev profile set` switches profiles correctly
- 70%+ test coverage on command handlers

---

## Implementation Notes

### Suggested Implementation Order

1. **Install Stricli** - add dependency
2. **Set up app.ts** - bootstrap application
3. **Implement init** - project initialization
4. **Implement doctor** - setup verification
5. **Implement capability list** - show capabilities
6. **Implement profile list/set** - profile management
7. **Implement agents sync** - generate files
8. **Implement types generate** - type definitions
9. **Implement serve** - start MCP server
10. **Write tests** - comprehensive coverage

### Validation Commands

```bash
# Run CLI directly
bun run packages/cli/src/index.ts --help
bun run packages/cli/src/index.ts init
bun run packages/cli/src/index.ts doctor
bun run packages/cli/src/index.ts capability list
bun run packages/cli/src/index.ts profile list
bun run packages/cli/src/index.ts agents sync

# Run tests
bun test packages/cli
```

---

## Codebase Patterns

Ralph should follow these patterns:

- Use Stricli's `buildCommand` for each command
- Use Stricli's `buildRouteMap` for subcommands
- Import from `@omnidev/core` for config/capability functions
- Use `console.log` for output, not TUI (MVP)
- Exit with code 1 on errors

---

