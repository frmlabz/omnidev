# PRD-005: Core Package - Capability System

**Status:** Ready  
**Priority:** 5 (Core - After types and config)  
**Estimated Effort:** Large

---

## Introduction / Overview

Implement the capability discovery, loading, and management system for OmniDev. Capabilities are the fundamental building blocks - plugins that add functionality, documentation, CLI commands, and TUI views. This PRD covers discovering capabilities in `omni/capabilities/`, loading their configuration and code, and extracting skills, rules, and docs.

---

## Goals

- Discover capabilities in the `omni/capabilities/` directory
- Load and parse `capability.toml` files
- Dynamically import capability `index.ts` files
- Extract skills from `skills/*/SKILL.md` files
- Extract rules from `rules/*.md` files
- Validate capability structure and exports
- Provide a registry of loaded capabilities

---

## User Stories

### US-001: Discover Capabilities

**Description:** As a developer, I need to discover all capabilities in the capabilities directory so that they can be loaded.

**Acceptance Criteria:**
- [ ] `discoverCapabilities` scans `omni/capabilities/`
- [ ] Directories with `capability.toml` are identified as capabilities
- [ ] Returns list of capability paths
- [ ] Handles empty directories gracefully
- [ ] Tests cover discovery scenarios
- [ ] Typecheck passes

---

### US-002: Load Capability Config

**Description:** As a developer, I need to load capability configuration so that I know what each capability provides.

**Acceptance Criteria:**
- [ ] `loadCapabilityConfig` reads and parses `capability.toml`
- [ ] Validates required fields (id, name, version)
- [ ] Handles optional fields (exports, env, mcp)
- [ ] Returns typed `CapabilityConfig` object
- [ ] Tests cover config loading
- [ ] Typecheck passes

---

### US-003: Load Skills from Capabilities

**Description:** As a developer, I need to load skills from capability directories so that they can be synced to agents.

**Acceptance Criteria:**
- [ ] `loadSkills` scans `skills/*/SKILL.md` in capability directory
- [ ] Parses YAML frontmatter (name, description)
- [ ] Extracts markdown content as instructions
- [ ] Returns array of `Skill` objects
- [ ] Handles capabilities with no skills gracefully
- [ ] Tests cover skill loading
- [ ] Typecheck passes

---

### US-004: Load Rules from Capabilities

**Description:** As a developer, I need to load rules from capability directories so that they can be synced to agents.

**Acceptance Criteria:**
- [ ] `loadRules` scans `rules/*.md` in capability directory
- [ ] Extracts filename as rule name
- [ ] Reads markdown content
- [ ] Returns array of `Rule` objects
- [ ] Handles capabilities with no rules gracefully
- [ ] Tests cover rule loading
- [ ] Typecheck passes

---

### US-005: Load Docs from Capabilities

**Description:** As a developer, I need to load documentation from capabilities so that it can be queried.

**Acceptance Criteria:**
- [ ] `loadDocs` scans `docs/*.md` in capability directory
- [ ] Also loads `definition.md` as base documentation
- [ ] Returns array of `Doc` objects
- [ ] Handles capabilities with no docs gracefully
- [ ] Tests cover doc loading
- [ ] Typecheck passes

---

### US-006: Dynamic Import Capability Code

**Description:** As a developer, I need to dynamically import capability code so that exports are available.

**Acceptance Criteria:**
- [ ] `importCapability` uses dynamic `import()` on `index.ts`
- [ ] Extracts exported functions for sandbox tools
- [ ] Extracts `cliCommands` if exported
- [ ] Extracts `cliViews` if exported
- [ ] Handles programmatic skills/rules/docs exports
- [ ] Tests cover import scenarios
- [ ] Typecheck passes

---

### US-007: Build Capability Registry

**Description:** As a developer, I need a capability registry so that other parts of the system can access loaded capabilities.

**Acceptance Criteria:**
- [ ] `loadAllCapabilities` loads all discovered capabilities
- [ ] Filters to only enabled capabilities (based on config/profile)
- [ ] Validates environment requirements
- [ ] Returns map of capability ID to `LoadedCapability`
- [ ] Provides helper functions to query registry
- [ ] Tests cover registry scenarios
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** Capabilities must be discovered by scanning for `capability.toml`
- **FR-2:** Programmatic exports (skills, rules, docs) take precedence over filesystem
- **FR-3:** Dynamic imports must handle missing or invalid files gracefully
- **FR-4:** Skills must parse YAML frontmatter with name and description
- **FR-5:** Reserved capability names must be rejected (fs, path, etc.)
- **FR-6:** Environment variables must be validated before capability is loaded
- **FR-7:** All loading errors must include capability ID in error message

---

## Non-Goals (Out of Scope)

- ❌ No MCP server wrapping (future feature)
- ❌ No capability installation from hub
- ❌ No hot reloading of capabilities
- ❌ No sandbox symlink setup (MCP package responsibility)

---

## Technical Considerations

### Capability Loader (`packages/core/src/capability/loader.ts`)

```typescript
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { LoadedCapability, CapabilityConfig } from '../types';
import { parseCapabilityConfig } from '../config/parser';
import { loadSkills } from './skills';
import { loadRules } from './rules';
import { loadDocs } from './docs';
import { validateEnv, loadEnvironment } from '../config/env';

const CAPABILITIES_DIR = 'omni/capabilities';
const RESERVED_NAMES = [
  'fs', 'path', 'http', 'https', 'crypto', 'os', 'child_process',
  'stream', 'buffer', 'util', 'events', 'net', 'url', 'querystring',
  'react', 'vue', 'lodash', 'axios', 'express', 'typescript',
];

export async function discoverCapabilities(): Promise<string[]> {
  if (!existsSync(CAPABILITIES_DIR)) {
    return [];
  }

  const entries = readdirSync(CAPABILITIES_DIR, { withFileTypes: true });
  const capabilities: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const configPath = join(CAPABILITIES_DIR, entry.name, 'capability.toml');
      if (existsSync(configPath)) {
        capabilities.push(join(CAPABILITIES_DIR, entry.name));
      }
    }
  }

  return capabilities;
}

export async function loadCapabilityConfig(
  capabilityPath: string
): Promise<CapabilityConfig> {
  const configPath = join(capabilityPath, 'capability.toml');
  const content = await Bun.file(configPath).text();
  const config = parseCapabilityConfig(content);

  // Validate name is not reserved
  if (RESERVED_NAMES.includes(config.capability.id)) {
    throw new Error(
      `Capability name "${config.capability.id}" is reserved. Choose a different name.`
    );
  }

  return config;
}

export async function loadCapability(
  capabilityPath: string,
  env: Record<string, string>
): Promise<LoadedCapability> {
  const config = await loadCapabilityConfig(capabilityPath);
  const id = config.capability.id;

  // Validate environment
  if (config.env) {
    validateEnv(config.env, env, id);
  }

  // Load content - programmatic takes precedence
  const exports = await importCapabilityExports(capabilityPath);
  
  const skills = exports.skills ?? await loadSkills(capabilityPath, id);
  const rules = exports.rules ?? await loadRules(capabilityPath, id);
  const docs = exports.docs ?? await loadDocs(capabilityPath, id);
  const typeDefinitions = exports.typeDefinitions ?? 
    await loadTypeDefinitions(capabilityPath);

  return {
    id,
    path: capabilityPath,
    config,
    skills,
    rules,
    docs,
    typeDefinitions,
    exports,
  };
}

async function importCapabilityExports(
  capabilityPath: string
): Promise<Record<string, unknown>> {
  const indexPath = join(capabilityPath, 'index.ts');
  
  if (!existsSync(indexPath)) {
    return {};
  }

  try {
    const module = await import(join(process.cwd(), indexPath));
    return module;
  } catch (error) {
    throw new Error(
      `Failed to import capability at ${capabilityPath}: ${error}`
    );
  }
}

async function loadTypeDefinitions(
  capabilityPath: string
): Promise<string | undefined> {
  const typesPath = join(capabilityPath, 'types.d.ts');
  
  if (!existsSync(typesPath)) {
    return undefined;
  }

  return Bun.file(typesPath).text();
}
```

### Skills Loader (`packages/core/src/capability/skills.ts`)

```typescript
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { Skill } from '../types';

interface SkillFrontmatter {
  name: string;
  description: string;
}

export async function loadSkills(
  capabilityPath: string,
  capabilityId: string
): Promise<Skill[]> {
  const skillsDir = join(capabilityPath, 'skills');
  
  if (!existsSync(skillsDir)) {
    return [];
  }

  const skills: Skill[] = [];
  const entries = readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = join(skillsDir, entry.name, 'SKILL.md');
      if (existsSync(skillPath)) {
        const skill = await parseSkillFile(skillPath, capabilityId);
        skills.push(skill);
      }
    }
  }

  return skills;
}

async function parseSkillFile(
  filePath: string,
  capabilityId: string
): Promise<Skill> {
  const content = await Bun.file(filePath).text();
  
  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    throw new Error(
      `Invalid SKILL.md format at ${filePath}: missing YAML frontmatter`
    );
  }

  const [, frontmatterStr, instructions] = frontmatterMatch;
  const frontmatter = parseYamlFrontmatter(frontmatterStr);

  if (!frontmatter.name || !frontmatter.description) {
    throw new Error(
      `Invalid SKILL.md at ${filePath}: name and description required`
    );
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    instructions: instructions.trim(),
    capabilityId,
  };
}

function parseYamlFrontmatter(yaml: string): SkillFrontmatter {
  const result: Record<string, string> = {};
  
  for (const line of yaml.split('\n')) {
    const match = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }

  return result as unknown as SkillFrontmatter;
}
```

### Rules Loader (`packages/core/src/capability/rules.ts`)

```typescript
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { Rule } from '../types';

export async function loadRules(
  capabilityPath: string,
  capabilityId: string
): Promise<Rule[]> {
  const rulesDir = join(capabilityPath, 'rules');
  
  if (!existsSync(rulesDir)) {
    return [];
  }

  const rules: Rule[] = [];
  const entries = readdirSync(rulesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const rulePath = join(rulesDir, entry.name);
      const content = await Bun.file(rulePath).text();
      
      rules.push({
        name: basename(entry.name, '.md'),
        content: content.trim(),
        capabilityId,
      });
    }
  }

  return rules;
}
```

### Docs Loader (`packages/core/src/capability/docs.ts`)

```typescript
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { Doc } from '../types';

export async function loadDocs(
  capabilityPath: string,
  capabilityId: string
): Promise<Doc[]> {
  const docs: Doc[] = [];

  // Load definition.md if exists
  const definitionPath = join(capabilityPath, 'definition.md');
  if (existsSync(definitionPath)) {
    const content = await Bun.file(definitionPath).text();
    docs.push({
      name: 'definition',
      content: content.trim(),
      capabilityId,
    });
  }

  // Load docs/*.md
  const docsDir = join(capabilityPath, 'docs');
  if (existsSync(docsDir)) {
    const entries = readdirSync(docsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const docPath = join(docsDir, entry.name);
        const content = await Bun.file(docPath).text();
        
        docs.push({
          name: basename(entry.name, '.md'),
          content: content.trim(),
          capabilityId,
        });
      }
    }
  }

  return docs;
}
```

### Capability Registry (`packages/core/src/capability/registry.ts`)

```typescript
import type { LoadedCapability, OmniConfig } from '../types';
import { discoverCapabilities, loadCapability } from './loader';
import { loadEnvironment } from '../config/env';
import { resolveEnabledCapabilities, getActiveProfile } from '../config/profiles';
import { loadConfig } from '../config/loader';

export interface CapabilityRegistry {
  capabilities: Map<string, LoadedCapability>;
  getCapability(id: string): LoadedCapability | undefined;
  getAllCapabilities(): LoadedCapability[];
  getAllSkills(): Skill[];
  getAllRules(): Rule[];
  getAllDocs(): Doc[];
}

export async function buildCapabilityRegistry(): Promise<CapabilityRegistry> {
  const config = await loadConfig();
  const env = await loadEnvironment();
  const activeProfile = await getActiveProfile();
  const enabledIds = resolveEnabledCapabilities(config, activeProfile);

  const capabilityPaths = await discoverCapabilities();
  const capabilities = new Map<string, LoadedCapability>();

  for (const path of capabilityPaths) {
    try {
      const cap = await loadCapability(path, env);
      
      // Only add if enabled
      if (enabledIds.includes(cap.id)) {
        capabilities.set(cap.id, cap);
      }
    } catch (error) {
      console.error(`Failed to load capability at ${path}:`, error);
    }
  }

  return {
    capabilities,
    getCapability: (id) => capabilities.get(id),
    getAllCapabilities: () => [...capabilities.values()],
    getAllSkills: () => [...capabilities.values()].flatMap(c => c.skills),
    getAllRules: () => [...capabilities.values()].flatMap(c => c.rules),
    getAllDocs: () => [...capabilities.values()].flatMap(c => c.docs),
  };
}
```

### Directory Structure

```
packages/core/src/
├── index.ts
├── types/
│   └── index.ts
├── config/
│   └── ...
└── capability/
    ├── index.ts           # Re-exports
    ├── loader.ts          # Discovery and loading
    ├── skills.ts          # Skills loading
    ├── rules.ts           # Rules loading
    ├── docs.ts            # Docs loading
    └── registry.ts        # Capability registry
```

---

## Touchpoints

Files to create or modify:

### Core Package
- `packages/core/src/capability/index.ts` - Exports (CREATE)
- `packages/core/src/capability/loader.ts` - Main loader (CREATE)
- `packages/core/src/capability/skills.ts` - Skills loading (CREATE)
- `packages/core/src/capability/rules.ts` - Rules loading (CREATE)
- `packages/core/src/capability/docs.ts` - Docs loading (CREATE)
- `packages/core/src/capability/registry.ts` - Registry (CREATE)
- `packages/core/src/index.ts` - Add exports (MODIFY)

### Tests
- `packages/core/src/capability/loader.test.ts` (CREATE)
- `packages/core/src/capability/skills.test.ts` (CREATE)
- `packages/core/src/capability/rules.test.ts` (CREATE)
- `packages/core/src/capability/docs.test.ts` (CREATE)
- `packages/core/src/capability/registry.test.ts` (CREATE)

---

## Dependencies

- ✅ PRD-001: Bun Monorepo Setup
- ✅ PRD-002: Code Quality Infrastructure
- ✅ PRD-003: Testing Infrastructure
- ✅ PRD-004: Core Types and Config

---

## Success Metrics

- All capabilities in `omni/capabilities/` are discovered
- Skills are parsed correctly from SKILL.md files
- Rules are loaded from rules/*.md
- Dynamic imports work for capability code
- Registry provides all loaded capabilities
- 70%+ test coverage on capability modules

---

## Implementation Notes

### Suggested Implementation Order

1. **Implement discovery** - scan for capabilities
2. **Implement config loading** - parse capability.toml
3. **Implement skills loading** - parse SKILL.md files
4. **Implement rules loading** - read rules/*.md
5. **Implement docs loading** - read definition.md and docs/*.md
6. **Implement dynamic import** - load index.ts
7. **Build registry** - combine everything
8. **Write tests** - comprehensive coverage

### Test Fixtures

Create test fixtures in `packages/core/src/capability/__fixtures__/`:

```
__fixtures__/
├── valid-capability/
│   ├── capability.toml
│   ├── index.ts
│   ├── skills/
│   │   └── test-skill/
│   │       └── SKILL.md
│   └── rules/
│       └── test-rule.md
├── minimal-capability/
│   └── capability.toml
└── invalid-capability/
    └── capability.toml  (missing required fields)
```

---

## Codebase Patterns

Ralph should follow these patterns:

- Use `Bun.file().text()` for async file reading
- Use `existsSync` for file existence checks
- Throw errors with capability ID context
- Use `process.cwd()` for absolute paths in dynamic imports
- Export all public APIs from package index

---

