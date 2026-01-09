# PRD-010: Provider-Aware Initialization

**Status:** Draft
**Priority:** High
**Estimated Effort:** Medium

---

## Introduction / Overview

The `dev init` command needs to support multiple AI providers (Claude and Codex) with provider-specific configurations and file generation. This PRD establishes the single `.omni` folder architecture with an internal `.gitignore` for working files, allowing teams to choose whether to share their OmniDev configuration.

---

## Goals

- Goal 1: Allow users to choose between Claude and Codex (or both) during initialization
- Goal 2: Generate provider-appropriate instruction files (AGENTS.md for Codex, claude.md for Claude)
- Goal 3: Establish single `.omni` folder with internal `.gitignore` for working files
- Goal 4: Give teams flexibility to share or keep `.omni` private

---

## User Stories

### US-051: Provider Selection During Init

**Description:** As a developer, I want to choose which AI provider I'm using during init so that the correct files are generated for my workflow.

**Acceptance Criteria:**
- [ ] `dev init` prompts user to select provider(s): Claude (default), Codex, or Both
- [ ] Claude is pre-selected as default
- [ ] Selection can be skipped with `--provider=claude|codex|both` flag
- [ ] Selected provider(s) stored in `.omni/provider.toml`
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-052: Provider-Specific File Generation

**Description:** As a developer using Codex, I want an AGENTS.md file created so that Codex can read my project instructions.

**Acceptance Criteria:**
- [ ] For Codex: Create `AGENTS.md` (uppercase) at project root
- [ ] For Claude: Create/append to `.claude/claude.md`
- [ ] If `.claude/claude.md` already exists, append OmniDev section at bottom
- [ ] Both files include placeholder for user to add 2-sentence project description
- [ ] Files reference `.omni/generated/rules.md` for capability rules
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-053: Single .omni Folder with Internal Gitignore

**Description:** As a developer, I want a single `.omni` folder with smart gitignore handling so I can choose whether to share config with my team.

**Acceptance Criteria:**
- [ ] All OmniDev files live in `.omni/` folder
- [ ] `.omni/.gitignore` created with patterns for working files
- [ ] Working files always ignored: `.env`, `generated/`, `state/`, `sandbox/`
- [ ] Init outputs message explaining sharing options:
  - "To share OmniDev config with team: commit .omni/ folder"
  - "To keep personal: add .omni to your project's .gitignore"
- [ ] Do NOT automatically modify project's root `.gitignore`
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-054: Project Description Placeholder

**Description:** As a developer, I want a clear placeholder in my instruction file so I know where to add my project description.

**Acceptance Criteria:**
- [ ] Both AGENTS.md and claude.md include a section like:
  ```
  ## Project Description
  <!-- TODO: Add 2-3 sentences describing your project -->
  [Describe what this project does and its main purpose]
  ```
- [ ] Placeholder is prominent and easy to find
- [ ] Init command outputs message reminding user to fill in project description
- [ ] Typecheck passes
- [ ] Tests pass

---

## Functional Requirements

- **FR-1:** The init command must prompt for provider selection with options: Claude (default), Codex, Both
- **FR-2:** Provider selection must be skippable via `--provider` CLI flag
- **FR-3:** Selected provider(s) must be stored in `.omni/provider.toml`
- **FR-4:** For Codex provider, system must create `AGENTS.md` at project root (uppercase)
- **FR-5:** For Claude provider, system must create `.claude/claude.md` or append to existing file
- **FR-6:** When appending to existing claude.md, content must be added at the bottom with clear separator
- **FR-7:** All OmniDev configuration must live in single `.omni/` folder
- **FR-8:** `.omni/.gitignore` must be created with patterns for transient/working files
- **FR-9:** Init must NOT modify project's root `.gitignore`
- **FR-10:** Init must output clear instructions about sharing options

---

## Non-Goals (Out of Scope)

- ❌ Auto-detection of existing provider configurations
- ❌ Migration from old init format to new format
- ❌ Support for providers other than Claude and Codex
- ❌ Automatic project description generation
- ❌ Automatic addition to root .gitignore

---

## User Journey

### Journey 1: Fresh Init with Claude (Default)

1. User runs `dev init` in a new project
2. System prompts: "Select your AI provider:"
   - [x] Claude (recommended)
   - [ ] Codex
3. User presses Enter to accept default (Claude)
4. System creates:
   - `.omni/` directory with all config files
   - `.omni/.gitignore` with working file patterns
   - `.claude/claude.md` with project description placeholder
5. System outputs:
   ```
   ✓ OmniDev initialized for Claude

   📝 Don't forget to add your project description to .claude/claude.md

   📁 Sharing options:
      • To share config with team: commit the .omni/ folder
      • To keep personal: add '.omni' to your project's .gitignore
   ```

### Journey 2: Init with Codex

1. User runs `dev init`
2. User selects Codex from prompt
3. System creates:
   - `.omni/` directory with all config files
   - `.omni/.gitignore` with working file patterns
   - `AGENTS.md` at project root with project description placeholder
4. System outputs similar message with Codex-specific instructions

### Journey 3: Team Sharing Workflow

1. Team lead runs `dev init` and configures capabilities
2. Team lead commits `.omni/` folder to repository
3. Developer clones project
4. Developer has all team configurations immediately available
5. Developer's working files (in `.omni/generated/`, etc.) are ignored by internal `.gitignore`

### Journey 4: Personal Use Workflow

1. Developer runs `dev init`
2. Developer adds `.omni` to project's root `.gitignore`
3. All OmniDev config is personal and not tracked

---

## Directory Structure

### New Single-Folder Layout

```
project/
├── .omni/                         # Single OmniDev folder
│   ├── .gitignore                 # Internal gitignore for working files
│   ├── config.toml                # Main configuration
│   ├── provider.toml              # Selected provider(s)
│   ├── capabilities.toml          # Enabled capabilities
│   ├── profiles.toml              # Profile definitions
│   ├── active-profile             # Current profile name
│   ├── .env                       # Environment secrets (always ignored)
│   ├── capabilities/              # Capability definitions
│   │   ├── tasks/
│   │   │   ├── capability.toml
│   │   │   ├── skills/
│   │   │   └── rules/
│   │   └── ralph/
│   │       └── ...
│   ├── generated/                 # Generated files (always ignored)
│   │   └── rules.md
│   ├── state/                     # Runtime state (always ignored)
│   └── sandbox/                   # Sandbox execution (always ignored)
│
├── .claude/                       # Claude provider (if selected)
│   ├── claude.md
│   └── skills/
│
└── AGENTS.md                      # Codex provider (if selected)
```

### Internal .gitignore Content

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

# Capability-specific patterns are appended below by each capability
```

---

## Data & Contracts

### Provider Configuration File

**Location:** `.omni/provider.toml`

```toml
# Single provider
provider = "claude"

# OR multiple providers
providers = ["claude", "codex"]
```

### TypeScript Types

```typescript
export type Provider = "claude" | "codex";

export interface ProviderConfig {
  provider?: Provider;           // Single provider
  providers?: Provider[];        // Multiple providers
}

export function getActiveProviders(config: ProviderConfig): Provider[] {
  if (config.providers) return config.providers;
  if (config.provider) return [config.provider];
  return ["claude"]; // Default
}
```

### AGENTS.md Template (Codex)

```markdown
# Project Instructions

## Project Description
<!-- TODO: Add 2-3 sentences describing your project -->
[Describe what this project does and its main purpose]

## Capabilities

This project uses OmniDev for capability management. See the rules below for available capabilities.

@import .omni/generated/rules.md
```

### claude.md Template

```markdown
# Project Instructions

## Project Description
<!-- TODO: Add 2-3 sentences describing your project -->
[Describe what this project does and its main purpose]

## Capabilities

This project uses OmniDev for capability management. See the rules below for available capabilities.

@import .omni/generated/rules.md
```

---

## Touchpoints

### CLI Package
- `packages/cli/src/commands/init.ts` - Rewrite for single folder structure
- `packages/cli/src/prompts/provider.ts` - New file for provider selection prompt

### Core Package
- `packages/core/src/types/index.ts` - Add Provider and ProviderConfig types
- `packages/core/src/config/provider.ts` - New file for provider config loading
- `packages/core/src/templates/agents.md.ts` - Template for AGENTS.md
- `packages/core/src/templates/claude.md.ts` - Template for claude.md
- `packages/core/src/gitignore/internal.ts` - Internal .gitignore management

### Tests
- `packages/cli/src/__tests__/init.test.ts` - Update for new structure

---

## Edge Cases

1. **User has existing `.omni/` folder from old version**
   - Solution: Detect and offer migration or skip

2. **User runs init twice**
   - Solution: Detect existing init, offer to reinitialize or skip

3. **Capability needs custom gitignore patterns**
   - Solution: Capabilities export `gitignore` array, merged into `.omni/.gitignore`

4. **User's `.claude/claude.md` has OmniDev section already**
   - Solution: Detect and skip appending duplicate

---

## Implementation Notes

### Suggested Implementation Order

**Story 1: Single Folder Structure (US-053)**
- Create new `.omni/` directory structure
- Create internal `.gitignore` with base patterns
- Remove old `omni/` folder logic

**Story 2: Provider Types and Config (US-051 partial)**
- Add Provider types to core package
- Create provider config loader
- Create `.omni/provider.toml` file handler

**Story 3: Provider Prompt (US-051)**
- Create interactive provider selection prompt
- Add `--provider` CLI flag
- Store selection in `.omni/provider.toml`

**Story 4: File Templates and Generation (US-052, US-054)**
- Create AGENTS.md and claude.md templates
- Implement provider-specific file generation
- Implement append-to-existing logic

**Story 5: Init Output Messages (US-053)**
- Add sharing options message
- Add project description reminder

---

## Dependencies

- ✅ Existing init command structure
- ✅ Bun file system APIs
- ❌ None - standalone feature
