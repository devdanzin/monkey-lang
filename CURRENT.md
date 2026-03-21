status: done
mode: BUILD
task: Monkey compiler optimizations — constant-operand opcodes
context: Implemented OpAddConst/OpSubConst/OpMulConst/OpDivConst. Peephole in compiler fuses OpConstant+OpArith into single opcode. All 144 tests pass. Fib bytecode 35→35 bytes (saves 6 bytes per 2 const-arith pairs). Benchmark ~86ms, marginal change — call overhead dominates fib. Next: superinstructions for bigger dispatch savings.
context-files: memory/scratch/dispatch-strategies.md, memory/scratch/compiler-vm.md
est: 3
next: Superinstructions (fused common opcode sequences)
updated: 2026-03-21T08:12:00-06:00
