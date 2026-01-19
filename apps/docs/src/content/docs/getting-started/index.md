---
title: Quick Start
description: Install OmniDev, add a capability, and sync in minutes.
sidebar:
  order: 1
---

Get OmniDev running quickly with a single flow.

## 1) Install the CLI

```bash
npm install -g @omnidev-ai/cli
```

Or with Bun:

```bash
bun install -g @omnidev-ai/cli
```

## 2) Initialize your project

```bash
omnidev init
```

This creates `OMNI.md`, `omni.toml`, and runtime files under `.omni/`.

## 3) Add a capability

Use the add command to register a capability and enable it in your active profile:

```bash
omnidev add cap my-cap --github user/repo
```

If the capability lives in a subdirectory:

```bash
omnidev add cap my-cap --github anthropics/skills --path skills/docx
```

## 4) Sync

```bash
omnidev sync
```

This fetches capabilities, generates `.omni/instructions.md`, and updates provider files.

## 5) Verify

```bash
omnidev doctor
```

If anything is missing, fix the config and rerun `omnidev doctor`.

## Next steps

- Add more capability sources to `omni.toml`.
- Switch profiles with `omnidev profile set <name>`.
- Edit `OMNI.md` to refine project instructions.
