status: done
mode: BUILD
task: Lexer fix — allow digits in identifiers after first character
context: Fixed readIdentifier() to accept digits after first char (e.g., x1, var2b). 1 new test. 234 tests, 19/19 benchmarks, 9.51x aggregate. Also reverted LICM codegen in previous block.
context-files: lessons/tracing-jit.md
est: 0
next: 16:45 MAINTAIN — Commit, run benchmarks, update README
updated: 2026-03-23T16:25:00-06:00
