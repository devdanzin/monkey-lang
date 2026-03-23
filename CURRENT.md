status: done
mode: BUILD
task: JIT LICM codegen for hash lookups — attempted pre-loop emission
context: Tried to hoist hash lookups (GUARD_HASH + INDEX_HASH) before the while() loop in codegen. IR-level LICM works but codegen fails because pre-loop guard exits reference the 'loop:' label (continue loop / side trace dispatch) which doesn't exist yet. Reverted. Hash lookups remain 2.0x — bottleneck is JS Map.get() per iteration. Need proper pre-loop codegen infrastructure to fix.
context-files: lessons/tracing-jit.md
est: 0
next: 16:45 MAINTAIN — Commit, run benchmarks, update README
updated: 2026-03-23T16:15:00-06:00
