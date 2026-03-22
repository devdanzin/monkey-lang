status: done
mode: BUILD
task: 14:30 BUILD — Comprehensive benchmark suite expansion
context: Added 8 new benchmarks (arrays, closures, higher-order, hashes). Discovered JIT bug: closures with free variables crash ("unknown opcode: 0") after trace compilation triggers (~56 iterations). Arrays also show 0 traces/regression. Higher-order fns work great (11-16x). All 185 tests still pass.
context-files: memory/scratch/tracing-jit-compilation.md
est: 0
next: 14:45 MAINTAIN — Commit, push, promote tracing-jit scratch note to lessons/
updated: 2026-03-22T14:28:00-06:00
