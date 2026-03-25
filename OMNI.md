# Project Instructions

<!-- This file is your project's instruction manifest for AI agents. -->
<!-- It will be combined with capability-generated content during sync. -->

## Project Description

OmniDev is a monorepo for a capability manager that lets teams define AI coding capabilities once and sync them across providers such as Claude Code, Codex, Cursor, and OpenCode. The repository includes the core capability/runtime logic, provider adapters and writers, the CLI and capability scaffolding tools, the docs site, and integration-style example coverage.

## Conventions

- Prefer small, behavior-focused changes that fit the existing package boundaries instead of adding cross-package abstractions early.
- Keep provider-agnostic capability behavior in `packages/core`; keep provider materialization in `packages/adapters`; keep CLI orchestration in `packages/cli`.
- Add or update tests for behavior changes in the package that owns the logic. For capability loading behavior, this usually means `packages/core/src/capability/*.test.ts`.
- Update docs when behavior or authoring conventions change. Capability authoring changes should usually touch the docs site under `apps/docs/src/content/docs/` and sometimes the root `README.md`.
- Prefer preserving existing release automation. If a task involves package versions or publishing, do not hand-edit versions unless the workflow explicitly requires it.

## Release Workflow

- This repo uses Changesets for release intent and CI for versioning/publishing.
- For user-facing changes, add a changeset file under `.changeset/`.
- Do not run `changeset version`, `bun run version`, or manually bump package versions just to prepare a normal feature commit. Those steps are handled by CI through the release workflow after merge.
- On pushes to `main`, [release.yml](/home/nikola/files/work/frmlabz/tools/omnidev/.github/workflows/release.yml) uses `changesets/action` to either:
  - create/update the release PR when changeset files are present, or
  - publish after the release PR merge when changeset files were deleted by the versioning step.
- Publishing is performed by [publish.mjs](/home/nikola/files/work/frmlabz/tools/omnidev/scripts/publish.mjs), which currently publishes the public packages:
  - `@omnidev-ai/cli`
  - `@omnidev-ai/capability`
- The CLI and capability packages are version-fixed together by Changesets config. Internal dependency alignment is validated during publish.
- If a user explicitly asks for a release-oriented change in-repo, the default action is:
  - add or update the relevant changeset
  - do not locally version-bump packages
  - do not regenerate changelogs unless explicitly requested for a release workflow task

## Architecture

- `packages/core`: capability discovery/loading, config parsing, sync bundle generation, MCP handling, hooks, state, security scanning, templates.
- `packages/adapters`: provider adapters and writers that materialize the provider-specific output files from the core sync bundle.
- `packages/cli`: end-user OmniDev CLI commands for init, add, sync, profile management, doctor, and capability operations.
- `packages/capability`: standalone capability authoring/scaffolding package.
- `apps/docs`: Astro/Starlight documentation site.
- `examples/`: integration-style examples that exercise sync behavior across real fixture setups.

## Validation

- For targeted behavior work, run the narrowest relevant test files first.
- Before finalizing broader repo changes, run `bun test` or `bun run test`.
- `bun run check` is the repo-wide validation entry point for typecheck, lint, and formatting when needed.
