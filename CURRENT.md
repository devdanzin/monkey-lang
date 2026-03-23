status: done
mode: BUILD
task: 13:30 JIT — uncompilable function tracking + algebraic simplification extensions
context: Added uncompilableFns set to prevent repeated compilation attempts on functions with unsupported opcodes. Fixed hash access from 0.53x→0.76x, string concat from 0.77x→1.30x. Added NEG(NEG(x))→x, NEG(const)→const, x/x→1 to algebraic simplification. 33 tests, 231 total.
context-files: lessons/tracing-jit.md
est: 0
next: 13:45 BUILD — continue JIT improvements (consider hash index recording or more peephole patterns)
updated: 2026-03-23T13:42:00-06:00
