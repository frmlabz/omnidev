# PRD-012: Directory Structure Documentation

**Status:** Draft
**Priority:** Medium
**Estimated Effort:** Small

---

## Introduction / Overview

With the single `.omni` folder architecture, users need clear documentation about how OmniDev organizes files, what gets shared vs ignored, and how to choose between team and personal usage modes. This PRD covers documentation and CLI output improvements to make the structure clear.

---

## Goals

- Goal 1: Clear documentation of the `.omni` folder structure
- Goal 2: Users understand the two usage modes (team shared vs personal)
- Goal 3: CLI commands provide helpful context about file locations

---

## User Stories

### US-060: Directory Structure Documentation

**Description:** As a developer, I want clear documentation about OmniDev's directory structure so I understand what files exist and why.

**Acceptance Criteria:**
- [ ] README section explains `.omni` folder structure
- [ ] Each config file's purpose is documented
- [ ] Internal `.gitignore` behavior is explained
- [ ] `dev doctor` validates directory structure
- [ ] Typecheck passes
- [ ] Tests pass

---

### US-061: Usage Mode Documentation

**Description:** As a team lead, I want to understand the two usage modes so I can choose the right approach for my team.

**Acceptance Criteria:**
- [ ] Documentation explains Team Mode (commit `.omni/`)
- [ ] Documentation explains Personal Mode (gitignore `.omni`)
- [ ] Pros/cons of each mode are listed
- [ ] Init output reminds user of options
- [ ] Typecheck passes
- [ ] Tests pass

---

## Functional Requirements

- **FR-1:** README must include directory structure section
- **FR-2:** Each file in `.omni/` must be documented
- **FR-3:** `dev doctor` must verify expected structure
- **FR-4:** CLI help must reference documentation

---

## Non-Goals (Out of Scope)

- ❌ Automatic mode detection/switching
- ❌ Mode enforcement policies
- ❌ External documentation site

---

## Directory Structure Reference

### Complete `.omni` Layout

```
.omni/                             # Single OmniDev folder
├── .gitignore                     # Internal gitignore (always present)
│
├── # === Configuration Files === #
├── config.toml                    # Project settings
├── provider.toml                  # AI provider selection
├── capabilities.toml              # Enabled capabilities
├── profiles.toml                  # Profile definitions
├── active-profile                 # Current profile name
│
├── # === Secrets (always ignored) === #
├── .env                           # Environment variables
│
├── # === Capabilities === #
├── capabilities/                  # Capability definitions
│   ├── tasks/
│   │   ├── capability.toml        # Capability metadata
│   │   ├── index.ts               # Exports (including gitignore)
│   │   ├── skills/
│   │   └── rules/
│   └── ralph/
│       ├── capability.toml
│       ├── index.ts
│       ├── skills/
│       └── rules/
│
├── # === Generated (always ignored) === #
├── generated/
│   └── rules.md                   # Aggregated rules for agents
│
├── # === Runtime (always ignored) === #
├── state/                         # Capability state storage
└── sandbox/                       # Sandbox execution
```

### What Gets Shared vs Ignored

| Path | Shared (Team Mode) | Always Ignored |
|------|-------------------|----------------|
| `.omni/.gitignore` | ✅ | - |
| `.omni/config.toml` | ✅ | - |
| `.omni/provider.toml` | ✅ | - |
| `.omni/capabilities.toml` | ✅ | - |
| `.omni/profiles.toml` | ✅ | - |
| `.omni/active-profile` | ✅ | - |
| `.omni/capabilities/` | ✅ | - |
| `.omni/.env` | - | ✅ |
| `.omni/generated/` | - | ✅ |
| `.omni/state/` | - | ✅ |
| `.omni/sandbox/` | - | ✅ |

---

## Usage Modes

### Team Mode (Shared)

**How:** Commit the `.omni/` folder to your repository.

**What gets shared:**
- Capability definitions and rules
- Enabled capabilities list
- Profile definitions
- Provider selection
- Project configuration

**What stays private:**
- Secrets in `.env`
- Generated files
- Runtime state
- Capability working files (via their gitignore exports)

**Best for:**
- Teams who want consistent AI agent behavior
- Projects with custom capabilities
- Standardized workflows across developers

### Personal Mode (Private)

**How:** Add `.omni` to your project's root `.gitignore`.

**What happens:**
- All OmniDev configuration is local to you
- Each developer sets up independently
- No shared capabilities or profiles

**Best for:**
- Personal projects
- Experimentation
- Teams who prefer independence

---

## Internal Gitignore Structure

The `.omni/.gitignore` file has two sections:

```gitignore
# ================================================
# OmniDev Core - Always Ignored
# ================================================
# These files are machine-specific and regenerated

# Secrets
.env

# Generated content
generated/

# Runtime state
state/

# Sandbox
sandbox/

# Logs
*.log

# ================================================
# Capability Patterns - Auto-Managed
# ================================================
# Added/removed when capabilities are enabled/disabled

# ralph capability
work/
*.tmp
progress.txt
```

The "Capability Patterns" section is automatically maintained:
- Patterns added when `dev capability enable <name>` is run
- Patterns removed when `dev capability disable <name>` is run
- Each capability's patterns are grouped under a comment

---

## Touchpoints

### Documentation
- `README.md` - Add directory structure section
- `docs/directory-structure.md` - Detailed documentation (if docs folder exists)

### CLI
- `packages/cli/src/commands/doctor.ts` - Validate structure
- `packages/cli/src/commands/init.ts` - Output mode explanation

### Tests
- `packages/cli/src/__tests__/doctor.test.ts` - Structure validation tests

---

## Implementation Notes

### Suggested Implementation Order

**Story 1: Doctor Validation (US-060)**
- Add structure check to `dev doctor`
- Verify all expected files/folders exist
- Check internal `.gitignore` is valid

**Story 2: Init Output Enhancement (US-060, US-061)**
- Add mode explanation to init output
- List created files with descriptions

**Story 3: README Documentation (US-060, US-061)**
- Add directory structure section to README
- Document both usage modes
- Add capability gitignore export example

---

## Dependencies

- ✅ PRD-010: Single folder structure
- ✅ PRD-011: Configuration system
