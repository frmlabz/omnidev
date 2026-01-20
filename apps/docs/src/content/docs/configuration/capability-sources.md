---
title: Capability Sources
description: Configure capability sources and enable them in profiles.
sidebar:
  order: 5
---

Capability sources are declared under `[capabilities.sources]` in `omni.toml`, and enabled per profile.

## GitHub sources

```toml
[capabilities.sources]
obsidian = "github:kepano/obsidian-skills"
```

### Pinned version

```toml
[capabilities.sources]
tools = { source = "github:user/repo", ref = "v1.0.0" }
```

## Local development

```toml
[capabilities.sources]
my-cap = "file://./capabilities/my-cap"
```

## Enable in a profile

```toml
[profiles.default]
capabilities = ["obsidian", "my-cap"]
```

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

See [Profiles](./profiles) for switching and managing capability sets.
