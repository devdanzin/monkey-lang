status: done
mode: BUILD
task: Fixed hash access JIT regression — added GUARD_HASH + INDEX_HASH IR ops, hash key caching
context: Hash lookups went from 0.88x (regression) to 2.2x speedup. Added hash recording in VM OpIndex, GUARD_HASH/INDEX_HASH compiler codegen, cached hashKey() on all key types. 233 tests passing, 19/19 benchmarks correct.
context-files: lessons/tracing-jit.md
est: 0
next: 14:45 MAINTAIN — Commit, run benchmarks, check PRs
updated: 2026-03-23T14:27:00-06:00
