status: in-progress
mode: BUILD
task: 13:45 BUILD — Optimize FunctionCompiler for raw integer arithmetic
context: FunctionCompiler works (fib(25) 5.0x JIT/VM) but uses boxed MonkeyInteger for all ops. Tracing JIT gets 20x on loops with raw ints. Converting FunctionCompiler to use raw int fast paths should push fib(25) to 10x+.
context-files: memory/scratch/side-trace-design.md, memory/scratch/tracing-jit-compilation.md
est: 2
next: 14:15 BUILD — Comprehensive benchmark suite + tests
updated: 2026-03-22T13:45:00-06:00
