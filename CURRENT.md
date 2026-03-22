status: done
mode: BUILD
task: 15:15 BUILD — Fix closure free variable JIT crash
context: Fixed! Two bugs: (1) LOAD_FREE in inlined closures referenced root frame's __free, now emits value as constant. (2) Guard exit IP pointed to operand byte, now points to OpCall instruction. 187 tests, closures 7-9x JIT speedup.
context-files: lessons/tracing-jit.md, memory/scratch/side-trace-design.md
est: 0
next: 15:30 BUILD — More benchmarks, possibly optimize closure dispatch further
updated: 2026-03-22T15:12:00-06:00
