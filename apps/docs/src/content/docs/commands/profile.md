---
title: profile
description: List and switch profiles.
sidebar:
  order: 7
---

Manage profiles for different capability sets.

## `profile list`

Show available profiles and the active profile.

```bash
omnidev profile list
```

## `profile set <name>`

Switch the active profile.

```bash
omnidev profile set planning
```

---

After switching, run:

```bash
omnidev sync
```

---

See [Profiles](/configuration/profiles/) for how to define profiles in `omni.toml`.
