---
"@omnidev-ai/core": minor
---

Support programmatic skills, rules, docs, and subagents from default exports

Capability loader now correctly reads programmatic content from both named exports (`export const skills = [...]`) and default exports (`export default { skills: [...] }`). Previously, only named exports worked, causing capabilities using the recommended `export default` pattern to have their programmatic skills ignored.
