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
| Environment loading | env.ts | Loads .omni/.env, validates declarations |
| TOML parsing | parser.ts | Uses smol-toml, validates capability.toml |
| Provider selection | provider.ts | Loads provider.toml, parses CLI flags |
| Profile management | profiles.ts | Active profile tracking, resolves capabilities |
| Capability enable/disable | capabilities.ts | Updates profiles + gitignore patterns |

## CONVENTIONS

**Config File Locations:**
- `.omni/config.toml` - main config (project name, default profile, profiles)
- `.omni/config.local.toml` - local overrides (gitignored)
- `.omni/provider.toml` - provider selection (claude/codex/both)
- `.omni/.env` - secrets, always gitignored

**Profile-Based Capability Management:**
- Profiles define capability sets in `[profiles.name].capabilities`
- `active_profile` in config.toml selects current profile
- `always_enabled_capabilities` list merged with profile capabilities
- Use `enableCapability()` / `disableCapability()` to update active profile

**Environment Variable Handling:**
- capability.toml `[env]` section declares requirements
- `required = true` → must be present or default
- `secret = true` → masked in logs/error messages
- `default = "value"` → optional with fallback

## ANTI-PATTERNS (THIS SUBSYSTEM)

- **NEVER** edit config.toml directly for capability changes - use enableCapability()/disableCapability()
- **NEVER** commit .omni/.env or config.local.toml - both gitignored
- **NEVER** parse TOML manually - use parseOmniConfig() / parseCapabilityConfig()
- **NEVER** ignore validateEnv() errors - required env vars block capability load
- **NEVER** assume process.env is complete - merge with .omni/.env via loadEnvironment()
