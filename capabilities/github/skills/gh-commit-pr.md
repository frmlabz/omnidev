---
name: gh-commit-pr
description: Create git commits and GitHub pull requests with gh CLI, including composing commit messages and PR descriptions from changes, respecting repo templates and PR-only workflow.
---

# Git Commit + PR (gh CLI)

## Workflow

- Check status and branch: `git status -sb`, `git branch --show-current`.
- Ensure you are not on `main`; create or switch to a feature branch.
- Review the diff: `git diff` / `git diff --stat`.
- Stage changes intentionally: `git add -A` or selective adds.
- Write a concise commit message; use the repo commit template if available.
- Commit: `git commit` (or `git commit -t .gitmessage` if needed).
- Push branch: `git push -u origin HEAD`.
- Create PR with a filled description using gh CLI.

## Commit message guidance

- Use imperative, present tense: "add", "fix", "update".
- Keep the first line under ~72 chars; be specific.
- Use a short body with bullets when helpful.
- Follow the local template if `.gitmessage` exists:
  - Fill in **Why**, **What changed**, **How tested**.

## PR description guidance

- Mirror `.github/pull_request_template.md` if it exists.
- Include:
  - **Summary**: 1-3 sentences.
  - **Changes**: bullet list of main edits.
  - **Testing**: commands run or "not run" with reason.
  - **Checklist**: changeset, docs, issue link if applicable.

## gh CLI commands

- Verify auth if needed: `gh auth status`.
- Create a PR body file from the template:

```bash
cat > /tmp/pr.md <<'PR_EOF'
## Summary
- 

## Changes
- 

## Testing
- [ ] bun run check
- [ ] bun test

## Checklist
- [ ] Linked or referenced a related issue (if applicable)
- [ ] Added tests or noted why not
- [ ] Added a changeset (if user-facing change)
- [ ] Updated docs (if behavior or usage changed)
PR_EOF
```

- Create the PR:

```bash
gh pr create \
  --base main \
  --head "$(git branch --show-current)" \
  --title "<short summary>" \
  --body-file /tmp/pr.md
```

- Review PR in browser: `gh pr view --web`.
- Update metadata if needed: `gh pr edit --add-label <label> --reviewer <user>`.

## Guardrails

- Never push directly to `main`.
- Ensure the branch is pushed before creating the PR.
- If checks are required, run or note them in the PR.
