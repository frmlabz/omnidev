---
title: Skills
description: Define reusable task procedures for AI agents.
sidebar:
  order: 6
---

Skills are reusable task definitions that agents can invoke. Each skill lives in its own folder with a `SKILL.md` file.

## Structure

Skills must be organized in subdirectories with a `SKILL.md` file. The `name` and `description` fields are required in the frontmatter.

```
my-capability/
└── skills/
    └── deploy/
        ├── SKILL.md
        └── deploy-script.sh
```

## SKILL.md format

```markdown
---
name: deploy
description: Deploy application to production
---

# Deploy Skill

## Steps

1. Run pre-deployment checks
2. Build production bundle
3. Deploy to server
```

All files in the skill directory (besides `SKILL.md`) are included as references.

**Note:** Unlike commands and subagents, skills cannot be flat files. They must always be in a subdirectory with `name` and `description` in the frontmatter.

## Skill variables

Skills support capability-local variable interpolation. Use `{OMNIDEV_*}` placeholders inside the skill, and define the corresponding unprefixed keys in a `.env` file next to `capability.toml`.

```markdown
---
name: kickoff-{OMNIDEV_PROJECT_NAME}
description: Planning workflow for {OMNIDEV_PROJECT_NAME}
---

Create a kickoff plan for {OMNIDEV_PROJECT_NAME}.
```

```dotenv
PROJECT_NAME=omnidev
```

This resolves to:

- `kickoff-omnidev`
- `Planning workflow for omnidev`
- `Create a kickoff plan for omnidev.`

Rules:

- Skills use `{OMNIDEV_PROJECT_NAME}` style placeholders.
- OmniDev reads `PROJECT_NAME` from the capability-local `.env`.
- Shell environment variables override values from the capability-local `.env`.
- Missing values fail sync/loading with an error.

## Programmatic skills

You can also export skills from `index.ts`. Programmatic `skillMd` content uses the same interpolation rules:

```typescript
import type { CapabilityExport } from "@omnidev-ai/capability";

export default {
  skills: [
    {
      // name and description go in the YAML frontmatter
      skillMd: `---
name: deploy-{OMNIDEV_PROJECT_NAME}
description: Deploy {OMNIDEV_PROJECT_NAME} to production
---

# Deploy

## Steps

1. Run pre-deployment checks
2. Build production bundle
3. Deploy {OMNIDEV_PROJECT_NAME} to server
`,
      references: [
        { name: "deploy.sh", content: "#!/bin/bash\necho Deploy" }
      ]
    }
  ]
} satisfies CapabilityExport;
```

## Tips

- Keep skill names short and action-oriented (`deploy`, `review-pr`).
- Use references for scripts/templates the agent should use.
- Use skill placeholders only for values that are capability-specific and safe to fail fast when missing.
