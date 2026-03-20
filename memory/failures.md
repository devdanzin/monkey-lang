# Failures & Patterns

Track recurring issues so future sessions don't repeat them.

## File Write Errors
- **Pattern:** Cron blocks try to write to ~/Projects/ which is outside the workspace
- **Fix:** All projects should live under the workspace, or use absolute paths
- **Seen:** 2026-03-18 (multiple blocks), 2026-03-19 (early blocks)

## Stale State in TASKS.md
- **Pattern:** Cron sessions read TASKS.md for blockers that were already resolved in the main session
- **Fix:** Update TASKS.md immediately when blockers are resolved, not just during MAINTAIN blocks
- **Seen:** 2026-03-19 (evening review thought BlueBubbles and email were still broken)
