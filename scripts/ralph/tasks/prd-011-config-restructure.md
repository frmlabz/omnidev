# PRD-011: Configuration and Capability System

**Status:** Draft
**Priority:** High
**Estimated Effort:** Medium

---

## Introduction / Overview

This PRD defines how configuration, profiles, and capabilities work within the single `.omni` folder architecture. It establishes explicit capability enablement (nothing enabled by default), profile management, and the capability gitignore export system that allows capabilities to add their working file patterns to `.omni/.gitignore`.

---

## Goals

- Goal 1: All configuration lives in single `.omni/` folder
- Goal 2: Capabilities must be explicitly enabled (Ralph NOT auto-enabled)
- Goal 3: Capabilities can export gitignore patterns for their working files
- Goal 4: Profiles can be defined and customized per user or team

---

## User Stories

### US-055: Explicit Capability Enablement

**Description:** As a developer, I want capabilities to be explicitly enabled so that nothing runs without my consent.

**Acceptance Criteria:**
- [ ] Fresh init creates `.omni/capabilities.toml` with no capabilities enabled
- [ ] User must run `dev capability enable <name>` to activate a capability
- [ ] `dev capability list` shows all available capabilities with enabled/disabled status
- [ ] `dev capability enable tasks` enables the tasks capability
- [ ] `dev capability disable tasks` disables a capability
- [ ] Ralph is available but NOT enabled by default
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-056: Capability Gitignore Export

**Description:** As a capability author, I want to export gitignore patterns so my working files are automatically ignored.

**Acceptance Criteria:**
- [ ] Capabilities can export `gitignore: string[]` from their `index.ts`
- [ ] Example: Ralph exports `["work/", "*.tmp"]`
- [ ] When capability is enabled, its patterns are added to `.omni/.gitignore`
- [ ] When capability is disabled, its patterns are removed from `.omni/.gitignore`
- [ ] Patterns are grouped under capability name comment
- [ ] `dev agents sync` updates `.omni/.gitignore` with capability patterns
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-057: Profile Management

**Description:** As a developer, I want to create and switch between profiles so I can have different capability configurations.

**Acceptance Criteria:**
- [ ] Profiles defined in `.omni/profiles.toml`
- [ ] Each profile has `enable` and `disable` lists that modify base capabilities
- [ ] `dev profile list` shows all available profiles with active indicator
- [ ] `dev profile set <name>` switches to a profile
- [ ] `dev profile create <name>` creates a new profile
- [ ] Active profile stored in `.omni/active-profile`
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-058: Config File Structure

**Description:** As a team lead, I want a clear config file structure so I understand what each file controls.

**Acceptance Criteria:**
- [ ] `.omni/config.toml` - Project name, default profile
- [ ] `.omni/capabilities.toml` - Which capabilities are enabled
- [ ] `.omni/profiles.toml` - Profile definitions
- [ ] `.omni/provider.toml` - Selected AI provider(s)
- [ ] All files have clear comments explaining their purpose
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-059: Migration from Old Structure

**Description:** As an existing user, I want my old `omni/` folder migrated to the new `.omni/` structure.

**Acceptance Criteria:**
- [ ] On run, detect old `omni/` folder structure
- [ ] Offer to migrate to new `.omni/` structure
- [ ] Move `omni/config.toml` → `.omni/config.toml`
- [ ] Move `omni/capabilities/` → `.omni/capabilities/`
- [ ] Create new required files (`.gitignore`, `capabilities.toml`, etc.)
- [ ] Delete old `omni/` folder after successful migration
- [ ] Show clear migration summary
- [ ] Typecheck passes
- [ ] Tests pass

---

## Functional Requirements

- **FR-1:** All OmniDev configuration must live in `.omni/` folder
- **FR-2:** Capabilities must be explicitly enabled via `dev capability enable`
- **FR-3:** Fresh init must NOT enable any capabilities by default
- **FR-4:** Ralph capability must require explicit enablement
- **FR-5:** Capabilities can export `gitignore: string[]` from `index.ts`
- **FR-6:** Capability gitignore patterns must be merged into `.omni/.gitignore`
- **FR-7:** Profiles must be stored in `.omni/profiles.toml`
- **FR-8:** Profile switching must update `.omni/active-profile`
- **FR-9:** System must detect and offer migration from old `omni/` structure
- **FR-10:** Migration must preserve all existing configurations

---

## Non-Goals (Out of Scope)

- ❌ GUI for configuration management
- ❌ Automatic capability recommendation
- ❌ Profile synchronization across machines
- ❌ Capability dependencies (auto-enabling required capabilities)

---

## User Journey

### Journey 1: Fresh Project Setup

1. User runs `dev init` in new project
2. System creates `.omni/` folder with:
   - `config.toml` - project settings
   - `capabilities.toml` - empty (no capabilities enabled)
   - `profiles.toml` - default profile
   - `.gitignore` - base working file patterns
3. User runs `dev capability list`
4. System shows available capabilities, all disabled:
   ```
   Available capabilities:
     ○ tasks     - Task management for AI agents
     ○ ralph     - PRD-driven development orchestrator
   ```
5. User runs `dev capability enable tasks`
6. System updates `.omni/capabilities.toml` with `enabled = ["tasks"]`
7. If tasks exports gitignore patterns, they're added to `.omni/.gitignore`

### Journey 2: Capability with Gitignore Export

1. User runs `dev capability enable ralph`
2. System loads ralph capability, finds:
   ```typescript
   // .omni/capabilities/ralph/index.ts
   export const gitignore = [
     "work/",
     "*.tmp",
     "progress.txt"
   ];
   ```
3. System appends to `.omni/.gitignore`:
   ```gitignore
   # ralph capability
   work/
   *.tmp
   progress.txt
   ```
4. User runs `dev capability disable ralph`
5. System removes ralph section from `.omni/.gitignore`

### Journey 3: Creating and Using Profiles

1. User runs `dev profile create planning`
2. System creates profile in `.omni/profiles.toml`:
   ```toml
   [profiles.planning]
   enable = []
   disable = []
   ```
3. User edits profile to enable ralph:
   ```toml
   [profiles.planning]
   enable = ["ralph"]
   ```
4. User runs `dev profile set planning`
5. System updates `.omni/active-profile` to "planning"
6. Now ralph is active when this profile is selected

### Journey 4: Migration from Old Structure

1. User has existing `omni/` folder from old version
2. User runs `dev init` or any command
3. System detects old structure and prompts:
   ```
   ⚠️  Found old OmniDev structure (omni/ folder)

   Would you like to migrate to the new .omni/ structure?
   This will:
     • Move omni/config.toml → .omni/config.toml
     • Move omni/capabilities/ → .omni/capabilities/
     • Create new config files
     • Remove old omni/ folder

   [Y/n]
   ```
4. User confirms, migration completes
5. Old `omni/` folder is removed

---

## Data & Contracts

### Configuration Files

**Main Config: `.omni/config.toml`**

```toml
# OmniDev Configuration
project = "my-project"
default_profile = "default"
```

**Capabilities State: `.omni/capabilities.toml`**

```toml
# Enabled capabilities
enabled = ["tasks"]

# Explicitly disabled (overrides profile)
disabled = []
```

**Profiles: `.omni/profiles.toml`**

```toml
[profiles.default]
# Default profile - base capabilities only

[profiles.planning]
enable = ["ralph"]
disable = []

[profiles.coding]
enable = ["tasks"]
disable = []
```

**Active Profile: `.omni/active-profile`**

```
default
```

### Capability Gitignore Export

```typescript
// .omni/capabilities/[name]/index.ts

// Optional gitignore patterns for working files
export const gitignore: string[] = [
  "work/",           // Working directory
  "*.tmp",           // Temp files
  "progress.txt",    // Progress tracking
];
```

### TypeScript Types

```typescript
// Capabilities state
export interface CapabilitiesState {
  enabled?: string[];
  disabled?: string[];
}

// Profile definition
export interface ProfileConfig {
  enable?: string[];
  disable?: string[];
}

// Profiles file
export interface ProfilesConfig {
  profiles?: Record<string, ProfileConfig>;
}

// Capability exports interface
export interface CapabilityExports {
  gitignore?: string[];
  // ... other exports
}
```

### Resolution Order

```typescript
export function resolveEnabledCapabilities(
  capabilitiesState: CapabilitiesState,
  profile: ProfileConfig | undefined
): string[] {
  // 1. Start with explicitly enabled capabilities
  const enabled = new Set(capabilitiesState.enabled ?? []);

  // 2. Apply profile modifications
  if (profile) {
    for (const cap of profile.enable ?? []) enabled.add(cap);
    for (const cap of profile.disable ?? []) enabled.delete(cap);
  }

  // 3. Apply explicit disables (highest priority)
  for (const cap of capabilitiesState.disabled ?? []) {
    enabled.delete(cap);
  }

  return Array.from(enabled);
}
```

### Internal Gitignore Format

```gitignore
# OmniDev working files - always ignored
# These files change frequently and are machine-specific

# Secrets
.env

# Generated content (rebuilt on sync)
generated/

# Runtime state
state/

# Sandbox execution
sandbox/

# Logs
*.log

# ============================================
# Capability-specific patterns (auto-managed)
# ============================================

# tasks capability
# (no additional patterns)

# ralph capability
work/
*.tmp
progress.txt
```

---

## Touchpoints

### Core Package
- `packages/core/src/config/loader.ts` - Update for new structure
- `packages/core/src/config/capabilities.ts` - Capability state management
- `packages/core/src/config/profiles.ts` - Profile management
- `packages/core/src/config/migration.ts` - Migration from old structure
- `packages/core/src/gitignore/manager.ts` - Internal gitignore management
- `packages/core/src/capability/loader.ts` - Load gitignore exports
- `packages/core/src/types/index.ts` - Add new types

### CLI Package
- `packages/cli/src/commands/capability.ts` - Add enable/disable commands
- `packages/cli/src/commands/profile.ts` - Profile management commands
- `packages/cli/src/commands/init.ts` - Migration detection

### Tests
- `packages/core/src/__tests__/config.test.ts` - Config loading tests
- `packages/core/src/__tests__/gitignore.test.ts` - Gitignore management tests
- `packages/cli/src/__tests__/capability.test.ts` - Enable/disable tests

---

## Edge Cases

1. **Capability exports invalid gitignore pattern**
   - Solution: Validate patterns, warn on invalid

2. **Two capabilities export same pattern**
   - Solution: Deduplicate, attribute to first capability

3. **User manually edits .omni/.gitignore**
   - Solution: Preserve manual edits outside managed sections

4. **Capability removed but gitignore patterns remain**
   - Solution: Clean up on capability removal

5. **Migration fails partway**
   - Solution: Atomic operations, rollback on failure, keep backup

6. **Profile references non-existent capability**
   - Solution: Warning message, skip unknown capabilities

---

## Implementation Notes

### Suggested Implementation Order

**Story 1: New Config Structure (US-058)**
- Create new config file loaders
- Update init to create new structure
- All files in `.omni/`

**Story 2: Capability Enable/Disable (US-055)**
- Add `dev capability enable <name>` command
- Add `dev capability disable <name>` command
- Update `dev capability list` with status

**Story 3: Gitignore Export System (US-056)**
- Add gitignore export to capability interface
- Create gitignore manager
- Merge capability patterns on enable
- Remove patterns on disable

**Story 4: Profile System (US-057)**
- Create profile management commands
- Profile storage in `.omni/profiles.toml`
- Profile switching via `.omni/active-profile`

**Story 5: Migration (US-059)**
- Detect old `omni/` structure
- Interactive migration prompt
- Safe migration with backup

---

## Dependencies

- ✅ PRD-010: Single folder structure
- ✅ Existing capability system
- ❌ None - can be done in parallel with PRD-010
