# Failures & Patterns

Track recurring issues so future sessions don't repeat them.

## File Write Errors
- **Pattern:** Cron blocks try to write to ~/Projects/ which is outside the workspace
- **Fix:** All projects should live under the workspace, or use absolute paths
- **Seen:** 2026-03-18 (multiple blocks), 2026-03-19 (early blocks)

## Daily Log Data Loss
- **Pattern:** A work block rewrites the entire daily log file, losing entries from previous blocks
- **Fix:** Blocks must READ the existing daily log first and APPEND their entry, never overwrite
- **Seen:** 2026-03-20 (8:45 entry lost after 9:00+ blocks wrote to the file)
- **Pattern:** Cron sessions read TASKS.md for blockers that were already resolved in the main session
- **Fix:** Update TASKS.md immediately when blockers are resolved, not just during MAINTAIN blocks
- **Seen:** 2026-03-19 (evening review thought BlueBubbles and email were still broken)

### Git remote confusion in shared workspace (2026-03-20)
**Problem:** Running `git remote add origin` in a subdirectory (`projects/monkey-lang/`) actually modified the parent workspace repo's remote, since monkey-lang isn't a separate git repo.
**Root cause:** monkey-lang is just a directory in the workspace repo, not a git submodule or separate repo.
**Fix:** Removed the bad remote. Future: if a project needs its own GitHub repo, either use `git subtree` or initialize it as a truly separate repo outside the workspace.
**Prevention:** Always check `git rev-parse --show-toplevel` before adding remotes in subdirectories.
