status: done
mode: BUILD
task: Fixed inlined fn guard exit IP bug
context: Guards inside inlined functions now exit to outermost callSiteIp instead of loop header. This ensures side trace recording starts at the correct IP (call site in caller frame) and interpreter resumes at the right place. 178/178 tests. Benchmarks stable — 21.7x hot loop, 6.6x inlined fns.
context-files: memory/scratch/side-trace-design.md, memory/scratch/tracing-jit-compilation.md
est: 0
next: 12:45 MAINTAIN — Commit side trace progress
updated: 2026-03-22T12:12:00-06:00
