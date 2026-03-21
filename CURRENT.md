status: done
mode: BUILD
task: Opcode specialization — integer cache + type-specialized opcodes
context: Added integer cache (-1 to 256), 6 specialized integer opcodes (AddInt, SubInt, GreaterThanInt, LessThanInt, EqualInt, NotEqualInt), and compiler type tracking. fib(25) improved from ~80ms to ~76ms (6.3%). Total VM speedup now 2.19x vs evaluator.
context-files: lessons/dispatch-strategies.md, lessons/compiler-vm-design.md, memory/scratch/vm-internals-lua-cpython.md
est: 0
next: 11:00 BUILD — Continue opcode specialization or next scheduled task
updated: 2026-03-21T10:45:00-06:00
