---
title: capability
description: List, enable, and disable capabilities.
sidebar:
  order: 5
---

Manage capabilities in your project.

## `capability list`

List discovered capabilities and their enabled status.

```bash
omnidev capability list
```

### Verbose output

Use `--verbose` to see detailed version information and check for available updates:

```bash
omnidev capability list --verbose
```

This shows:
- **Version**: from `capability.toml`, `plugin.json`, `package.json`, or commit/content hash
- **Version source**: where the version was detected from
- **Commit**: for git sources
- **Content hash**: for file sources (SHA-256)
- **Last update**: timestamp of last sync
- **Update available**: when a newer version exists in the remote repository

Example output:
```
Capabilities:

  ✓ enabled  My Cap
             ID: my-cap
             Version: 1.0.0 → 1.1.0 available
```

## `capability enable <name>`

Enable a capability in the active profile.

```bash
omnidev capability enable tasks
```

## `capability disable <name>`

Disable a capability in the active profile.

```bash
omnidev capability disable tasks
```

---

After enabling or disabling, run:

```bash
omnidev sync
```

---

To create a new capability, see [`capability new`](/commands/capability-new/).
