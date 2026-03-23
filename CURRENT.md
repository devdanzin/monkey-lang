status: done
mode: BUILD
task: JIT optimizer: store-to-load forwarding + LICM
context: Implemented both passes in TraceOptimizer. S2LF tracks last store per slot, forwards loads to stored value refs, invalidates on CALL. LICM finds loop-invariant instructions (all operand refs defined pre-loop or themselves invariant, no side effects) and hoists them above LOOP_START. 4 new tests, all 215 tests passing.
context-files: lessons/tracing-jit.md
est: 0
next: BUILD — Continue JIT optimizer work or move to next schedule item
updated: 2026-03-23T10:28:00-06:00
