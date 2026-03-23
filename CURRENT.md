status: done
mode: BUILD
task: JIT optimizer: box-unbox elimination + dead store elimination
context: Added two new optimizer passes. Box-unbox elimination removes UNBOX_INT(BOX_INT(x))→x and BOX_INT(UNBOX_INT(x))→x chains. Dead store elimination removes stores overwritten before any load (respects CALLs and LOOP_END boundaries). 4 new tests, all 219 tests passing. Benchmarks stable.
context-files: lessons/tracing-jit.md
est: 0
next: 11:45 MAINTAIN — commit, full test suite
updated: 2026-03-23T10:43:00-06:00
updated: 2026-03-23T10:28:00-06:00
