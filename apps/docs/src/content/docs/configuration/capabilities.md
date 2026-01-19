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

After editing `omni.toml`, run:

```bash
omnidev sync
```

See [Profiles](./profiles) for switching and managing capability sets.
