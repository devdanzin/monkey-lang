status: in-progress
mode: BUILD
task: JIT trace optimization passes — constant folding, dead guard elimination, CSE
context: IR is recorded but compiled directly without optimization. Adding optimization passes between recording and code generation. Starting with redundant guard elimination (biggest win — many guards are for values already guarded).
context-files: lessons/compiler-vm-design.md, memory/scratch/tracing-jit-compilation.md
est: 2
next: More opcode coverage (string concat, boolean comparisons in traces)
updated: 2026-03-22T09:31:00-06:00
