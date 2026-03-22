status: in-progress
mode: BUILD
task: Implement side traces (recording + compilation + VM dispatch)
context: Side trace design complete. Need to: 1) Add HOT_EXIT_THRESHOLD + sideTraces map to JIT/Trace, 2) Modify TraceRecorder for side trace mode, 3) Update VM._executeTrace to check sideTraces map, 4) Handle loop_back linking.
context-files: memory/scratch/side-trace-design.md, memory/scratch/tracing-jit-compilation.md
est: 5
next: Continue side trace implementation or start function inlining
updated: 2026-03-22T11:16:00-06:00
