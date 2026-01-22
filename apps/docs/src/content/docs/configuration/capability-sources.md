---
title: Capability Sources
description: Configure capability sources and enable them in profiles.
sidebar:
  order: 5
---

Capability sources are declared under `[capabilities.sources]` in `omni.toml`, and enabled per profile.

Tip: you can either edit `omni.toml` directly, or use [`omnidev add cap`](../commands/add) to add a source and enable it in your active profile.

## GitHub sources

```toml
[capabilities.sources]
obsidian = { source = "github:kepano/obsidian-skills", version = "latest" }
```

Shorthand syntax is also supported—when omitted, `version` defaults to `"latest"`:

```toml
[capabilities.sources]
obsidian = "github:kepano/obsidian-skills"
```

### Pinned version

Pin to a specific version or commit hash:

```toml
[capabilities.sources]
tools = { source = "github:user/repo", version = "v1.0.0" }
```

You can use the `--pin` flag when adding a capability to automatically detect and pin to the current version:

```bash
omnidev add cap tools --github user/repo --pin
```

This will:
1. Check the capability's `capability.toml` for a version field
2. Fall back to the current commit hash if no version is found

## Local development

```toml
[capabilities.sources]
my-cap = "file://./capabilities/my-cap"
```

Local sources should point at a capability directory with a `capability.toml` at its root. If you're starting from a folder of skills/rules/docs, see [Creating Capabilities](../advanced/creating-capabilities) for how to add a minimal `capability.toml`.

## Enable in a profile

```toml
[profiles.default]
capabilities = ["obsidian", "my-cap"]
```

## Listing sources and versions

- **Configured sources**: check `[capabilities.sources]` in `omni.toml`.
- **Pinned versions/commits**: after `omnidev sync`, check `omni.lock.toml`.
- **Installed/enabled capabilities**: run:

```bash
omnidev capability list
```

For detailed version information including sources, commits, and content hashes:

```bash
omnidev capability list --verbose
```

This shows:
- **Version**: from `capability.toml`, `plugin.json`, `package.json`, or commit/content hash
- **Version source**: where the version was detected from
- **Commit**: for git sources
- **Content hash**: for file sources (SHA-256)
- **Last update**: timestamp of last sync
- **Update available**: when using `--verbose`, shows if a newer version exists

## Version warnings

During `omnidev sync`, you may see warnings about version issues:

```
Syncing...
  ✓ my-cap
  ✓ other-cap

  ! third-cap: no version specified, defaulting to latest
```

| Warning | Meaning |
|---------|---------|
| `no version specified, defaulting to latest` | Source config missing `version` field—will use latest |
| `version unchanged but content changed` | Commit changed but capability version stayed same |

These warnings help detect potential issues with capability updates. Consider pinning versions for stability.

## Capability groups

Groups let you bundle multiple capabilities under a single name for cleaner profile configurations.

### Defining groups

```toml
[capabilities.groups]
expo = ["expo-app-design", "expo-deployment", "upgrading-expo"]
backend = ["cloudflare", "database-tools"]
```

### Using groups in profiles

Reference groups with the `group:` prefix:

```toml
[profiles.mobile]
capabilities = ["group:expo", "react-native-tools"]

[profiles.fullstack]
capabilities = ["group:expo", "group:backend"]
```

### Deduplication

Capabilities are automatically deduplicated. If a capability appears in multiple groups or is listed both directly and in a group, it's only enabled once.

```toml
[capabilities.groups]
frontend = ["react", "typescript"]
fullstack = ["react", "node", "typescript"]

[profiles.dev]
# Results in: react, typescript, node (no duplicates)
capabilities = ["group:frontend", "group:fullstack"]
```

---

After editing `omni.toml`, run:

```bash
omnidev sync
```

## Security considerations (supply chain)

Capabilities are effectively third-party code + prompts. Treat adding a new source like adding a dependency:

- Prefer **pinned versions** (`version = "v1.2.3"` or a commit hash) for important environments (CI, shared teams).
- Review `omni.lock.toml` changes in PRs (especially new sources or updated commits).
- Be cautious with capabilities that include **sync hooks**, **hook scripts**, **MCP servers**, or **programmatic code** (`index.ts` + dependencies).
- Prefer known orgs/repos, and avoid enabling capabilities you wouldn't trust to run locally.

### Version tracking

OmniDev tracks versions for reproducibility:

- **Git sources**: commits are stored in `omni.lock.toml`
- **File sources**: SHA-256 content hashes are computed and stored
- **Version detection**: checks `capability.toml` → `plugin.json` → `package.json` → commit/hash

The lock file records `version_source` to show where each version came from, making audits easier.

### Security scanning (opt-in)

OmniDev includes optional security scanners that can detect potential supply-chain issues:

```toml
[security]
mode = "warn"  # "off" (default), "warn", or "error"

[security.scan]
unicode = true     # Detect bidi overrides, zero-width chars, control chars
symlinks = true    # Detect symlinks escaping capability directories
scripts = true     # Detect suspicious patterns in hooks/scripts
binaries = false   # Detect binary files in content folders
```

**Findings include:**
- **Unicode attacks**: Bidirectional text overrides that can hide malicious code
- **Symlink escapes**: Links that escape the capability directory
- **Suspicious scripts**: Patterns like `curl | sh`, `rm -rf /`, etc.

Set `mode = "error"` to fail sync on high-severity findings.

See [Profiles](./profiles) for switching and managing capability sets.
