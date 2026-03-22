status: done
mode: BUILD
task: Implement function inlining in tracing JIT
context: Function inlining fully working. Trace recorder follows execution into called functions (up to depth 3), maps callee locals via baseOffset, returns values back to caller context. Fixed BOX_INT elision bug for cross-frame refs. 175/175 tests pass. Function calls in loops: 14.68x speedup.
context-files: memory/scratch/side-trace-design.md, memory/scratch/tracing-jit-compilation.md
est: 0
next: 13:00 THINK — Review inlining, plan next (recursive tracing? benchmarks? blog?)
updated: 2026-03-22T11:55:00-06:00
