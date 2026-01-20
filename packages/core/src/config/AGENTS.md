# CONFIGURATION SUBSYSTEM

**Generated:** 2026-01-12T10:36:46
**Commit:** (not specified)
**Branch:** (not specified)

## OVERVIEW
Configuration loading and parsing system using TOML format with profile-based capability management.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Config merge logic | loader.ts | Merges config.toml + config.local.toml |
| TOML parsing | parser.ts | Uses smol-toml, validates capability.toml |
| Provider selection | provider.ts | Loads provider.toml, parses CLI flags |
| Profile management | profiles.ts | Active profile tracking, resolves capabilities |
| Capability enable/disable | capabilities.ts | Updates profiles + gitignore patterns |

## CONVENTIONS

**Config File Locations:**
- `.omni/config.toml` - main config (project name, default profile, profiles)
- `.omni/config.local.toml` - local overrides (gitignored)
- `.omni/provider.toml` - provider selection (claude/codex/both)

**Profile-Based Capability Management:**
- Profiles define capability sets in `[profiles.name].capabilities`
- `active_profile` in config.toml selects current profile
- `always_enabled_capabilities` list merged with profile capabilities
- Use `enableCapability()` / `disableCapability()` to update active profile

## ANTI-PATTERNS (THIS SUBSYSTEM)

- **NEVER** edit config.toml directly for capability changes - use enableCapability()/disableCapability()
- **NEVER** parse TOML manually - use parseOmniConfig() / parseCapabilityConfig()
