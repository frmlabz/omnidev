---
title: Skills
description: Define reusable task procedures for AI agents.
sidebar:
  order: 6
---

Skills are reusable task definitions that agents can invoke. Each skill lives in its own folder with a `SKILL.md` file.

## Structure

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

## Programmatic skills

You can also export skills from `index.ts`:

```typescript
import type { CapabilityExport } from "@omnidev-ai/core";

export default {
  skills: [
    {
      skillMd: "---\nname: deploy\ndescription: Deploy\n---\n\n# Deploy\n...",
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
