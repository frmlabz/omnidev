---
title: Capability Management
description: List, enable, and disable capabilities.
sidebar:
  order: 2
---

## `omnidev capability list`

List discovered capabilities and their enabled status.

```bash
omnidev capability list
```

## `omnidev capability enable <name>`

Enable a capability in the active profile.

```bash
omnidev capability enable tasks
```

## `omnidev capability disable <name>`

Disable a capability in the active profile.

```bash
omnidev capability disable tasks
```

After enabling or disabling, run:

```bash
omnidev sync
```
