status: in-progress
mode: BUILD
task: Monkey compiler: superinstructions (fused OpGetLocal + Op*Const)
context: Implementing OpGetLocal{Add,Sub,Mul,Div}Const - fuses 2 dispatches into 1. High impact for fib benchmark. Peephole in emitArithOrConst checks previousInstruction for OpGetLocal.
context-files: memory/scratch/dispatch-strategies.md, memory/scratch/compiler-vm.md
est: 2
next: Blog post - "How Bytecode VMs Actually Work"
updated: 2026-03-21T08:32:00-06:00
