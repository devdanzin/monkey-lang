status: done
mode: THINK
task: Side trace architecture design
context: Designed VM-dispatched side traces. Parent exits check sideTraces map before falling to interpreter. Side trace records from exitIp, ends at parent loop header. ~100 lines to implement. Wrote scratch note with full design.
context-files: memory/scratch/side-trace-design.md, memory/scratch/tracing-jit-compilation.md
est: 0
next: 11:15 BUILD — Implement side traces (recording + compilation + VM dispatch)
updated: 2026-03-22T11:02:00-06:00
