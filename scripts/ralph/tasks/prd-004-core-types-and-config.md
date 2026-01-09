# PRD-004: Core Package - Types and Configuration

**Status:** Ready  
**Priority:** 4 (Core - After foundation)  
**Estimated Effort:** Medium

---

## Introduction / Overview

Implement the core types, interfaces, and configuration system for OmniDev. This includes all TypeScript interfaces that define the system's data structures, the TOML configuration parser, and the layered configuration system (team + local config merging).

This is the foundation for the capability system and all other packages.

---

## Goals

- Define all core TypeScript interfaces and types
- Implement TOML configuration parsing using `smol-toml`
- Create the layered config system (team config + local overrides)
- Implement profile management logic
- Export all types for use by other packages

---

## User Stories

### US-001: Define Core TypeScript Types

**Description:** As a developer, I need well-defined TypeScript interfaces so that the entire system has type safety.

**Acceptance Criteria:**
- [ ] `Capability` interface defined with all fields
- [ ] `CapabilityConfig` interface for capability.toml
- [ ] `Skill`, `Rule`, `Doc` interfaces defined
- [ ] `OmniConfig` interface for omni/config.toml
- [ ] `Profile` interface defined
- [ ] All types exported from `@omnidev/core`
- [ ] Typecheck passes

---

### US-002: Implement TOML Parser

**Description:** As a developer, I need to parse TOML configuration files so that the system can read config.toml and capability.toml files.

**Acceptance Criteria:**
- [ ] `smol-toml` is installed as a dependency
- [ ] `parseToml` function parses TOML string to object
- [ ] Parser handles all TOML data types correctly
- [ ] Parser provides helpful error messages for invalid TOML
- [ ] Tests cover parsing scenarios
- [ ] Typecheck passes

---

### US-003: Implement Config Loader

**Description:** As a developer, I need to load and merge configuration files so that team and local configs work together.

**Acceptance Criteria:**
- [ ] `loadConfig` function reads `omni/config.toml`
- [ ] `loadConfig` reads `.omni/config.local.toml` if it exists
- [ ] Configs are merged with local taking precedence
- [ ] Missing files are handled gracefully (not errors)
- [ ] Tests cover merge scenarios
- [ ] Typecheck passes

---

### US-004: Implement Profile Resolution

**Description:** As a developer, I need profile resolution logic so that enabled capabilities can be determined based on the active profile.

**Acceptance Criteria:**
- [ ] `getActiveProfile` reads from `.omni/active-profile`
- [ ] `resolveEnabledCapabilities` combines base config with profile
- [ ] Profile `enable` adds to base capabilities
- [ ] Profile `disable` removes from base capabilities
- [ ] Default profile is used when none is active
- [ ] Tests cover profile scenarios
- [ ] Typecheck passes

---

### US-005: Implement Environment Loading

**Description:** As a developer, I need environment variable loading so that capabilities can access secrets and config.

**Acceptance Criteria:**
- [ ] `loadEnvironment` reads from `.omni/.env` file
- [ ] Environment from process.env takes precedence
- [ ] `validateEnv` checks required env vars from capability config
- [ ] Missing required vars throw helpful errors
- [ ] Secret values are identified for masking
- [ ] Tests cover env scenarios
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** All interfaces must use strict TypeScript (no `any` types)
- **FR-2:** Config parser must handle TOML 1.0 syntax
- **FR-3:** Config merging must deep-merge objects, not shallow merge
- **FR-4:** Profile resolution must be deterministic
- **FR-5:** Environment loading must not expose secrets in errors
- **FR-6:** All public functions must be exported from package index

---

## Non-Goals (Out of Scope)

- ❌ No capability loading logic (separate PRD)
- ❌ No type generation for LLM consumption
- ❌ No provider-specific config generation
- ❌ No file watching for config changes

---

## Technical Considerations

### Core Types (`packages/core/src/types/index.ts`)

```typescript
// Capability Types
export interface CapabilityMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface CapabilityExports {
  module?: string;
}

export interface EnvDeclaration {
  required?: boolean;
  secret?: boolean;
  default?: string;
}

export interface CapabilityConfig {
  capability: CapabilityMetadata;
  exports?: CapabilityExports;
  env?: Record<string, EnvDeclaration | Record<string, never>>;
  mcp?: McpConfig;
}

export interface McpConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  transport?: 'stdio' | 'sse';
}

// Content Types
export interface Skill {
  name: string;
  description: string;
  instructions: string;
  capabilityId: string;
}

export interface Rule {
  name: string;
  content: string;
  capabilityId: string;
}

export interface Doc {
  name: string;
  content: string;
  capabilityId: string;
}

// Config Types
export interface ProfileConfig {
  enable?: string[];
  disable?: string[];
}

export interface CapabilitiesConfig {
  enable?: string[];
  disable?: string[];
}

export interface OmniConfig {
  project?: string;
  default_profile?: string;
  capabilities?: CapabilitiesConfig;
  env?: Record<string, string>;
  profiles?: Record<string, ProfileConfig>;
}

// Loaded Capability
export interface LoadedCapability {
  id: string;
  path: string;
  config: CapabilityConfig;
  skills: Skill[];
  rules: Rule[];
  docs: Doc[];
  typeDefinitions?: string;
  exports: Record<string, unknown>;
}
```

### Config Parser (`packages/core/src/config/parser.ts`)

```typescript
import { parse } from 'smol-toml';
import type { OmniConfig, CapabilityConfig } from '../types';

export function parseOmniConfig(tomlContent: string): OmniConfig {
  try {
    return parse(tomlContent) as OmniConfig;
  } catch (error) {
    throw new Error(`Invalid TOML in config: ${error}`);
  }
}

export function parseCapabilityConfig(tomlContent: string): CapabilityConfig {
  try {
    const parsed = parse(tomlContent);
    // Validate required fields
    if (!parsed.capability?.id) {
      throw new Error('capability.id is required');
    }
    return parsed as CapabilityConfig;
  } catch (error) {
    throw new Error(`Invalid capability.toml: ${error}`);
  }
}
```

### Config Loader (`packages/core/src/config/loader.ts`)

```typescript
import { existsSync } from 'fs';
import { parseOmniConfig } from './parser';

const TEAM_CONFIG = 'omni/config.toml';
const LOCAL_CONFIG = '.omni/config.local.toml';

export async function loadConfig(): Promise<OmniConfig> {
  let teamConfig: OmniConfig = {};
  let localConfig: OmniConfig = {};

  if (existsSync(TEAM_CONFIG)) {
    const content = await Bun.file(TEAM_CONFIG).text();
    teamConfig = parseOmniConfig(content);
  }

  if (existsSync(LOCAL_CONFIG)) {
    const content = await Bun.file(LOCAL_CONFIG).text();
    localConfig = parseOmniConfig(content);
  }

  return mergeConfigs(teamConfig, localConfig);
}

function mergeConfigs(base: OmniConfig, override: OmniConfig): OmniConfig {
  return {
    ...base,
    ...override,
    capabilities: {
      enable: [
        ...(base.capabilities?.enable ?? []),
        ...(override.capabilities?.enable ?? []),
      ],
      disable: [
        ...(base.capabilities?.disable ?? []),
        ...(override.capabilities?.disable ?? []),
      ],
    },
    env: {
      ...base.env,
      ...override.env,
    },
  };
}
```

### Profile Resolution (`packages/core/src/config/profiles.ts`)

```typescript
import { existsSync } from 'fs';
import type { OmniConfig, ProfileConfig } from '../types';

const ACTIVE_PROFILE_FILE = '.omni/active-profile';

export async function getActiveProfile(): Promise<string | null> {
  if (!existsSync(ACTIVE_PROFILE_FILE)) {
    return null;
  }
  return (await Bun.file(ACTIVE_PROFILE_FILE).text()).trim();
}

export async function setActiveProfile(name: string): Promise<void> {
  await Bun.write(ACTIVE_PROFILE_FILE, name);
}

export function resolveEnabledCapabilities(
  config: OmniConfig,
  profileName: string | null
): string[] {
  // Start with base capabilities
  const baseEnabled = new Set(config.capabilities?.enable ?? []);
  const baseDisabled = new Set(config.capabilities?.disable ?? []);

  // Apply profile if specified
  const profile = profileName 
    ? config.profiles?.[profileName]
    : config.profiles?.[config.default_profile ?? 'default'];

  if (profile) {
    for (const cap of profile.enable ?? []) {
      baseEnabled.add(cap);
    }
    for (const cap of profile.disable ?? []) {
      baseDisabled.add(cap);
    }
  }

  // Return enabled minus disabled
  return [...baseEnabled].filter(cap => !baseDisabled.has(cap));
}
```

### Environment Loading (`packages/core/src/config/env.ts`)

```typescript
import { existsSync } from 'fs';
import type { EnvDeclaration } from '../types';

const ENV_FILE = '.omni/.env';

export async function loadEnvironment(): Promise<Record<string, string>> {
  const env: Record<string, string> = {};

  // Load from .omni/.env
  if (existsSync(ENV_FILE)) {
    const content = await Bun.file(ENV_FILE).text();
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1);
          env[key] = value;
        }
      }
    }
  }

  // Process env takes precedence
  return { ...env, ...process.env } as Record<string, string>;
}

export function validateEnv(
  declarations: Record<string, EnvDeclaration | Record<string, never>>,
  env: Record<string, string | undefined>,
  capabilityId: string
): void {
  for (const [key, decl] of Object.entries(declarations)) {
    const declaration = decl as EnvDeclaration;
    const value = env[key] ?? declaration.default;

    if (declaration.required && !value) {
      throw new Error(
        `Missing required env var ${key} for capability "${capabilityId}". ` +
        `Set it in .omni/.env or as an environment variable.`
      );
    }
  }
}

export function isSecretEnvVar(
  key: string,
  declarations: Record<string, EnvDeclaration | Record<string, never>>
): boolean {
  const decl = declarations[key] as EnvDeclaration | undefined;
  return decl?.secret === true;
}
```

### Directory Structure

```
packages/core/src/
├── index.ts                    # Re-exports everything
├── types/
│   └── index.ts               # All type definitions
├── config/
│   ├── index.ts               # Re-exports config modules
│   ├── parser.ts              # TOML parsing
│   ├── loader.ts              # Config loading & merging
│   ├── profiles.ts            # Profile management
│   └── env.ts                 # Environment handling
└── test-utils/
    └── ...                    # From PRD-003
```

---

## Touchpoints

Files to create or modify:

### Core Package
- `packages/core/src/types/index.ts` - Type definitions (CREATE)
- `packages/core/src/config/index.ts` - Config exports (CREATE)
- `packages/core/src/config/parser.ts` - TOML parser (CREATE)
- `packages/core/src/config/loader.ts` - Config loader (CREATE)
- `packages/core/src/config/profiles.ts` - Profile logic (CREATE)
- `packages/core/src/config/env.ts` - Environment handling (CREATE)
- `packages/core/src/index.ts` - Package exports (MODIFY)
- `packages/core/package.json` - Add smol-toml dependency (MODIFY)

### Tests
- `packages/core/src/config/parser.test.ts` - Parser tests (CREATE)
- `packages/core/src/config/loader.test.ts` - Loader tests (CREATE)
- `packages/core/src/config/profiles.test.ts` - Profile tests (CREATE)
- `packages/core/src/config/env.test.ts` - Env tests (CREATE)

---

## Dependencies

- ✅ PRD-001: Bun Monorepo Setup
- ✅ PRD-002: Code Quality Infrastructure
- ✅ PRD-003: Testing Infrastructure
- `smol-toml`: TOML parser (to be installed)

---

## Success Metrics

- All types compile without errors
- `smol-toml` parses valid TOML correctly
- Config merging works as specified
- Profile resolution is deterministic
- Environment loading handles all cases
- 70%+ test coverage on config modules

---

## Implementation Notes

### Suggested Implementation Order

1. **Install smol-toml** - add dependency
2. **Create types** - all interfaces first
3. **Implement parser** - TOML parsing
4. **Implement loader** - config loading & merging
5. **Implement profiles** - profile resolution
6. **Implement env** - environment handling
7. **Write tests** - comprehensive coverage
8. **Update exports** - package index

### Validation Commands

```bash
# Type check
bun run typecheck

# Run tests
bun test packages/core

# Check coverage
bun test --coverage packages/core
```

---

## Codebase Patterns

Ralph should follow these patterns:

- Use `Bun.file().text()` for file reading
- Use `existsSync` from `fs` for file existence checks
- Throw descriptive errors with context
- Never expose secret values in error messages
- Export all public APIs from package index

---

