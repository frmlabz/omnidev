---
title: capability.toml
description: Metadata required for a capability.
sidebar:
  order: 3
---

`capability.toml` is required for every capability. OmniDev uses it to identify and validate the capability during discovery.

## Minimal example

```toml
[capability]
id = "testing-guide"
name = "Testing Guide"
version = "1.0.0"
description = "Guidelines and patterns for testing in OmniDev."
```

## Field notes

- **id**: unique, kebab-case identifier. Avoid reserved names like `fs`, `path`, `react`, or `typescript`.
- **name**: human-readable title.
- **version**: semantic version string.
- **description**: short summary shown in listings.
