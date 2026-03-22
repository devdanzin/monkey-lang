status: done
mode: BUILD
task: JIT opcode coverage — added recording for superinstructions, OpGetFree, OpBang
context: Added JIT recording for OpGetLocal*Const (superinstructions), OpGetFree, and OpBang. Superinstructions decompose into LOAD_LOCAL + CONST_INT + arith IR. 7.8x speedup on 10k loop benchmark. 166 tests passing.
context-files: lessons/compiler-vm-design.md, memory/scratch/tracing-jit-compilation.md
est: 0
next: 09:30 BUILD — Continue JIT (trace optimization passes, or more opcode coverage)
updated: 2026-03-22T09:28:00-06:00
