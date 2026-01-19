---
title: Profiles
description: Manage different capability sets for different workflows.
sidebar:
  order: 4
---

Profiles let you switch between different capability sets without rewriting config.

## Example

```toml
[profiles.default]
capabilities = ["tasks"]

[profiles.planning]
capabilities = ["ralph", "tasks"]

[profiles.frontend]
capabilities = ["tasks", "ui-design"]
```

## Switch profiles

```bash
omnidev profile set planning
```

## Tips

- Keep a lightweight `default` profile for daily work.
- Use profiles to separate planning, coding, and review workflows.

See [Capability Sources](./capabilities) for how to add capabilities that profiles can enable.
