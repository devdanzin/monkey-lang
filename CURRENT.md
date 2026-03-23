status: done
mode: BUILD
task: JIT optimizer: common subexpression elimination (CSE)
context: Added CSE pass that deduplicates pure ops (loads, arithmetic, unbox, constants) with identical operands. Key insight: must defer _replaceRef calls to avoid mutating operands mid-scan (which caused false CSE matches). Reduced loop trace from 25→21 IR ops. 2 new tests, all 221 passing. Benchmarks stable (26x loop, 16x nested, 9x fib).
context-files: lessons/tracing-jit.md
est: 0
next: 11:45 MAINTAIN — commit, full test suite
updated: 2026-03-23T11:05:00-06:00
