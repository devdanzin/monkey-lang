status: done
mode: BUILD
task: JIT trace optimization passes — constant folding, dead guard elimination, DCE
context: Added 3 optimization passes to TraceOptimizer. Fixed critical compaction bug where numeric operands (value/slot/index) were incorrectly remapped as IR refs. Hot loop benchmark: 6.4x JIT vs VM. 171 tests passing.
context-files: lessons/compiler-vm-design.md, memory/scratch/tracing-jit-compilation.md
est: 0
next: More opcode coverage (string concat, boolean comparisons) or trace call inlining
updated: 2026-03-22T09:43:00-06:00
