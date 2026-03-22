status: done
mode: BUILD
task: Fix optimizer regression — implemented loop variable promotion
context: Implemented loop variable promotion in JIT compiler. Promoted loop-carried globals to raw JS variables, eliminating box/unbox per iteration. Hot loop went from 7.19x to 12.5x. 171 tests pass. Key technique: detect globals with STORE(BOX_INT(...)) pattern, promote to let vars before loop, write back on exit.
context-files: lessons/compiler-vm-design.md, memory/scratch/tracing-jit-compilation.md
est: 0
next: 10:45 MAINTAIN — Commit fixes
updated: 2026-03-22T10:29:00-06:00
