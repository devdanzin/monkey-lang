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

### JIT raw/boxed type confusion (2026-03-22)
**Problem:** CONST_INT IR produces raw JS numbers but typeMap marked them as 'int' (MonkeyInteger). UNBOX_INT then called .value on raw numbers → undefined → NaN → all arithmetic silently wrong. GUARD_TRUTHY used JS truthiness on MonkeyBoolean objects (always truthy as objects) → guards never fired.
**Root cause:** Two "worlds" in the IR (raw JS values vs MonkeyObject wrappers) with inconsistent type tracking.
**Fix:** Mark CONST_INT as 'raw_int' in typeMap. Skip UNBOX_INT and GUARD_INT when type is already 'raw_int'. Use __isTruthy() for MonkeyObject guards.
**Prevention:** Every IR instruction must have a clear contract: does it produce raw or boxed values? Document this in the IR opcode definitions. Test with logging the generated JS source.

### JIT closure free variable crash (2026-03-22)
**Problem:** Closures with free variables (e.g., `let adder = fn(x) { fn(y) { x + y } }; let addFive = adder(5)`) crash with "unknown opcode: 0" when the calling loop hits JIT trace compilation threshold (~56 iterations). Works fine with <56 iterations (no trace) and works fine without JIT.
**Root cause:** TBD — likely the trace compiler doesn't correctly handle OpGetFree or OpClosure bytecodes when inlining closure calls into traces. May be corrupting bytecode or generating invalid compiled trace code.
**Fix:** TODO — investigate how trace recording handles call sites for closures vs regular functions. Check if free variable loading is implemented in the trace IR.
**Workaround:** Closures with free vars work fine in interpreter and VM modes. JIT only crashes when the loop triggers trace compilation.
