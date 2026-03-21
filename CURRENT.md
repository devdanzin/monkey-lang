status: in-progress
mode: BUILD
task: Monkey compiler optimizations — opcode specialization (constant-operand opcodes)
context: Yesterday built full compiler+VM (31 opcodes, 104 tests, 2x faster than interpreter). Today applying dispatch strategy research — start with constant-operand opcodes to reduce stack ops.
context-files: memory/scratch/dispatch-strategies.md, memory/scratch/compiler-vm.md, memory/scratch/vm-internals-lua-cpython.md
est: 4
next: Superinstructions (fused common opcode sequences)
updated: 2026-03-21T08:15:00-06:00
