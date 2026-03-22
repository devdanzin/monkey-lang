status: done
mode: BUILD
task: 13:15 BUILD — Inline side trace code into root trace guard exits
context: Done. Added __sideTraces param to compiled traces. Guard exits check for side traces inline and call them directly, then continue loop on loop_back. Added __reloadPromoted() for re-reading promoted vars. 178/178 tests. Hot loop 20.3x, nested 4.2x.
context-files: memory/scratch/side-trace-design.md, memory/scratch/tracing-jit-compilation.md
est: 0
next: 13:30 BUILD — Continue inlining: true IR-level side trace merging (or move to fib tracing)
updated: 2026-03-22T13:22:00-06:00
