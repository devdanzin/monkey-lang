status: done
mode: BUILD
task: Monkey compiler: superinstructions (fused OpGetLocal + Op*Const)
context: Implemented OpGetLocal{Add,Sub,Mul,Div}Const. fib(25) 85.7→80.4ms (6% faster, 2.06x vs eval). 144 tests passing. Committed.
context-files: memory/scratch/dispatch-strategies.md, memory/scratch/compiler-vm.md
est: 0
next: Blog post - "How Bytecode VMs Actually Work" (Lua vs CPython vs Monkey)
updated: 2026-03-21T08:40:00-06:00
