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
