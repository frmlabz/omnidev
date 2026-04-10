---
"@omnidev-ai/core": patch
---

Fix sync corrupting parent git repository when a capability's `.git` directory is empty or invalid. Previously, an empty `.git` directory passed the existence check, causing `git fetch --depth 1` and `git reset --hard` to walk up and operate on the user's project repo instead. Now validates that `.git` is a real standalone repository before running any git commands, and re-clones when the repo is corrupted.
