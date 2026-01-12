# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-12
**Commit:** (not specified)
**Branch:** (not specified)

## OVERVIEW
Core capability loading system: discovers capabilities from .omni/capabilities/ & capabilities/, validates TOML configs, loads TypeScript exports (skills/rules/docs/commands/subagents), and builds runtime registry.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Capability discovery | loader.ts | Scans .omni/capabilities/ & capabilities/ for capability.toml |
| Load TOML config | loader.ts | Validates required fields, checks reserved names |
| Dynamic imports | loader.ts | Imports index.ts exports, handles missing deps gracefully |
| Registry build | registry.ts | Filters by enabled caps, aggregates all content types |
| Skills loading | skills.ts | Parses SKILL.md with YAML frontmatter |
| Rules loading | rules.ts | Loads *.md from rules/ directory |
| Docs loading | docs.ts | Loads definition.md + docs/*.md |
| Commands loading | commands.ts | Parses COMMAND.md with YAML frontmatter |
| Subagents loading | subagents.ts | Parses SUBAGENT.md, supports tools/skills/models |
| Remote sources | sources.ts | Git clone/fetch, wrap external repos, lock file mgmt |

## CONVENTIONS

**Capability Structure:**
- Must have capability.toml in root
- Optional: index.ts (exports: skills/rules/docs/commands/subagents/gitignore)
- Optional directories: skills/, rules/, docs/, commands/, subagents/
- Optional types.d.ts (for LLM type hints)

**YAML Frontmatter Format:**
- Skills/Commands: name, description (required)
- Subagents: name, description + optional tools/disallowedTools/model/permissionMode/skills
- Supports kebab-case keys (converted to camelCase)

**Content Loading Priority:**
- Programmatic exports (index.ts) take precedence over file-based content
- Loader converts both old and new export formats automatically

**Reserved Names:**
- Node builtins (fs, path, http, crypto, os, etc.)
- Common libs (react, vue, lodash, axios, express, typescript)
- Prevents import conflicts with capability modules

**Remote Capability Sources:**
- Shorthand: "github:user/repo#ref"
- Lock file: .omni/capabilities.lock.toml (tracks versions/commits)
- Wrap mode: discovers skills/agents/commands in repo without capability.toml
- Version: from package.json if available, else short commit hash

## ANTI-PATTERNS (THIS MODULE)

- **NEVER** use reserved capability names (fs, path, react, typescript, etc.)
- **NEVER** commit capabilities.lock.toml modifications - auto-generated
- **NEVER** skip YAML frontmatter validation - name/description required
- **NEVER** modify generated capability.toml in wrapped repos
- **NEVER** assume index.ts exists - loader returns empty object if missing
