# Versioning System Improvements - Implementation Summary

## Goal

Improve capability versioning with:
1. Rename `ref` to `version` for clearer semantics
2. Add `--pin` flag to CLI for pinning to detected versions
3. Add version mismatch warnings during sync
4. Extend `capability list` to show available updates
5. Add integrity verification checks

## Completed Changes

### Phase 1: Renamed `ref` to `version`

**Type Changes:**
- `packages/core/src/types/index.ts`:
  - `GitCapabilitySourceConfig.ref` → `version`
  - `CapabilityLockEntry.ref` → `pinned_version`
  - `CapabilitySource.ref` → `pinnedVersion`

**No Backwards Compatibility:**
- `packages/core/src/capability/sources.ts`:
  - `parseSourceConfig()`: Only accepts `version` (no `ref` support)
  - `loadLockFile()`: Only reads `pinned_version` (no `ref` migration)
  - `stringifyLockFile()`: Writes `pinned_version`
  - Old configs using `ref` must be manually updated to `version`

**Display Updates:**
- `packages/cli/src/commands/capability.ts`: Changed "Ref" label to "Pinned"

### Phase 2: Added `--pin` flag

**New Function:**
- `packages/core/src/capability/sources.ts`: Added `detectPinVersion(sourceUrl, subPath?)` that:
  1. Clones repo to temp location
  2. Checks capability.toml for version field
  3. Falls back to HEAD commit hash

**CLI Changes:**
- `packages/cli/src/commands/add.ts`:
  - Added `pin?: boolean` to `AddCapFlags`
  - Added `--pin` flag definition
  - Integrated detection logic for `--github` sources

**TOML Formatting:**
- `packages/core/src/config/toml-patcher.ts`:
  - Git sources: Always include `version`, defaults to `"latest"`
  - File sources: Remain simple strings (no version field)

**Examples:**
```bash
# Without --pin (default)
omnidev add cap --github user/repo
# Writes: my-cap = { source = "github:user/repo", version = "latest" }

# With --pin
omnidev add cap --github user/repo --pin
# Writes: my-cap = { source = "github:user/repo", version = "v1.0.0" }
```

### Phase 3: Version Mismatch Warnings

**New Types & Functions:**
- `packages/core/src/capability/sources.ts`:
  - `SyncWarning` interface: `{ id: string; message: string }`
  - `FetchAllResult` interface: `{ results: FetchResult[]; warnings: SyncWarning[] }`
  - `checkVersionMismatch()`: Detects when commit changed but version unchanged

**Integration:**
- `fetchAllCapabilitySources()`: Now returns `FetchAllResult` with warnings
- `packages/core/src/sync.ts`: `buildSyncBundle()` and `syncAgentConfiguration()` pass through warnings
- `packages/cli/src/commands/sync.ts`: Displays warnings after sync

**Warning Messages:**
| Situation | Message |
|-----------|---------|
| No version in config | `! my-cap: no version specified, defaulting to latest` |
| Version unchanged but content changed | `! my-cap: version unchanged but content changed` |

### Phase 4: Capability List Updates

**Changes:**
- `packages/cli/src/commands/capability.ts`:
  - With `--verbose`: Calls `checkForUpdates()` and shows update status
  - Display format: `Version: 1.0.0 → 1.1.0 available`

### Phase 5: Integrity Checks

**New Function:**
- `packages/core/src/capability/sources.ts`: Added `verifyIntegrity(id, lockEntry)` that:
  - For git sources: Verifies commit matches lock entry
  - For file sources: Verifies content hash matches
  - Returns warning message or null

### Documentation Updates

- `docs/versioning.md`: Updated all examples, type definitions, and architecture diagrams

### Test Updates

- `packages/core/src/capability/sources.test.ts`: Updated to use `version` and `pinned_version`
- `packages/core/src/config/toml-patcher.test.ts`: Updated expectations for new format
- `packages/cli/src/commands/add.test.ts`: Updated expectations for git sources with version

## Remaining Work

### 1. Update Examples
- [ ] No `examples/` omni.toml files found - verify no examples need updating

### 2. Update Init Command
- [x] `packages/cli/src/commands/init.ts` - Checked: Base omni.toml template only creates profiles, no capability sources. **No changes needed.**

### 3. Update Website Documentation

**Completed updates:**

#### `apps/docs/src/content/docs/configuration/capability-sources.md`
- [x] Updated GitHub source example to show new format with `version = "latest"`
- [x] Changed "Pinned version" example from `ref` to `version`
- [x] Changed "pinned refs" to "pinned versions"
- [x] Added documentation about `--pin` flag
- [x] Added documentation about version warnings during sync

#### `apps/docs/src/content/docs/configuration/omni-toml-reference.md`
- [x] Updated all `ref` field references to `version`
- [x] Updated complete example to use new format

#### `apps/docs/src/content/docs/configuration/config-files.md`
- [x] Checked: Uses shorthand format which is backwards compatible. **No changes needed.**

#### `apps/docs/src/content/docs/capabilities/overview.md`
- [x] Checked: Uses shorthand format which is backwards compatible. **No changes needed.**

#### `apps/docs/src/content/docs/index.mdx`
- [x] Checked: Uses shorthand format which is backwards compatible. **No changes needed.**

#### `apps/docs/src/components/QuickStart.astro`
- [x] Checked: No capability source examples. **No changes needed.**

#### `apps/docs/src/components/Hero.astro`
- [x] Checked: No capability source examples. **No changes needed.**

#### `apps/docs/src/content/docs/commands/add.md`
- [x] Documented new `--pin` flag with examples

#### `apps/docs/src/content/docs/commands/sync.md`
- [x] Documented version warnings with table of warning types

#### `apps/docs/src/content/docs/commands/capability.md`
- [x] Documented `--verbose` flag for update checking

### 4. Update Integration Tests
- [x] `packages/core/src/capability/wrapping-integration.test.ts` - Checked: Only contains capability.toml version field, not source config ref. **No changes needed.**

### 5. Edge Cases
- [x] Backwards compatibility removed - old configs using `ref` must be manually updated to `version`
- [x] No migration support - lock files using `ref` must be regenerated with `omnidev sync`
- [ ] Test `--pin` flag with various repository types

## New Behavior Summary

### omni.toml Format

```toml
[capabilities.sources]
# Git sources use version field (defaults to "latest")
my-cap = { source = "github:user/repo", version = "latest" }
pinned = { source = "github:user/repo", version = "v1.0.0" }

# Shorthand syntax also supported (version defaults to "latest")
shorthand = "github:user/repo"

# File sources use simple string format (no version field)
local = "file://./capabilities/my-cap"
```

### omni.lock.toml Format

```toml
[capabilities.my-cap]
source = "github:user/repo"
version = "1.0.0"
pinned_version = "v1.0.0"
commit = "abc123..."
updated_at = "2024-01-15T10:30:00Z"
```

### CLI Output Changes

**Sync with warnings:**
```
Syncing...
  ✓ my-cap
  ✓ other-cap

  ! third-cap: no version specified, defaulting to latest

Total: 3 synced
```

**Capability list with updates:**
```
Capabilities:

  ✓ enabled  My Cap
           ID: my-cap
           Version: 1.0.0 → 1.1.0 available
```
