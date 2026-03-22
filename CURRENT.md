status: in-progress
mode: BUILD
task: 13:15 BUILD — Inline side trace code into root trace guard exits
context: Adding __sideTraces param to compiled traces. Guard exits will check for side traces inline and call them directly, then continue loop on loop_back. Eliminates VM dispatch roundtrip.
context-files: memory/scratch/side-trace-design.md, memory/scratch/tracing-jit-compilation.md
est: 3
next: 14:15 BUILD — Recursive fibonacci tracing + benchmarks
updated: 2026-03-22T13:15:00-06:00
