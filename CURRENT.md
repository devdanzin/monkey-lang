status: done
mode: BUILD
task: JIT type specialization — adaptive quickening for arithmetic opcodes
context: Implemented PEP 659-style adaptive quickening. Generic ops (OpAdd/Sub/Mul/Div/Equal/NotEqual/GreaterThan) self-specialize to Int variants after 8 consecutive integer observations. Specialized ops have deopt guards — rewrite back to generic on type mismatch. Added OpMulInt/OpDivInt opcodes. All 211 tests pass, 4 new quickening tests added.
context-files: lessons/tracing-jit.md, memory/scratch/deoptimization-jit.md
est: 0
next: MAINTAIN — Git cleanup, dashboard update, commit
updated: 2026-03-23T09:13:00-06:00
