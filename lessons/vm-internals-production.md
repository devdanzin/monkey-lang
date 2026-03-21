# Production VM Internals: Lua 5.4 & CPython

Promoted from `memory/scratch/vm-internals-lua-cpython.md` (3 uses across 2026-03-20, 2026-03-21).

## Core Lesson

Studying production VMs reveals design patterns that textbooks skip. The gap between "toy VM" and "production VM" is primarily about **reducing per-instruction overhead** through encoding tricks and specialization.

## Lua 5.4: Register VM Done Right

### Instruction Encoding
32-bit instructions with 7-bit opcode. Five formats (iABC, iABx, iAsBx, iAx, isJ) let the compiler pack register indices, constants, and small immediates into single instructions. The `k` bit in iABC format doubles flexibility — `RKC(i)` reads either a register or constant pool entry based on one bit.

**Takeaway:** Instruction encoding is a design decision with huge downstream effects. Wider instructions = fewer dispatches = faster execution on modern CPUs where branch misprediction dominates.

### Arithmetic Macro Layering
Lua's `lvm.c` uses three arithmetic macro variants:
- `op_arith(L, iop, fop)` — register + register
- `op_arithK(L, iop, fop)` — register + constant from K[]
- `op_arithI(L, iop, fop)` — register + signed 8-bit immediate

All check `ttisinteger()` first. If both operands are integers, compute and `pc++` to skip the following metamethod opcode.

**The pc++ trick:** Every arithmetic opcode is followed by `OP_MMBIN`/`OP_MMBINI`/`OP_MMBINK`. On success, the handler skips it. On failure, execution falls through to the metamethod call. This is zero-cost fast-path design — the slow path is there in the bytecode but never dispatched when types match.

### Notable Optimizations
- **FORLOOP counter:** `OP_FORPREP` pre-computes an iteration count. Loop body just decrements and checks > 0. Avoids limit comparison and overflow issues.
- **RETURN0/RETURN1:** Inline the entire `poscall` logic, avoiding a function call for the most common return patterns.
- **Same C frame:** `OP_CALL` for Lua functions uses `goto startfunc` instead of C recursion. All Lua-to-Lua calls share one C stack frame — prevents C stack overflow on deep Lua recursion.
- **LFALSESKIP:** Combined `set false + skip next instruction` for if/else patterns. Eliminates a jump.

## CPython: Stack VM + Adaptive Specialization

### Architecture
2-byte instructions (opcode + arg). Pure stack-based — simpler compilation but ~2x more instructions than Lua for equivalent code.

### CPython 3.11+ Specialization (PEP 659)
The game-changer: opcodes self-modify at runtime. `BINARY_ADD` becomes `BINARY_ADD_INT` after seeing int operands. This is inline caching at the bytecode level — a hybrid between interpretation and JIT. De-specialization is trivial: rewrite one byte.

**Takeaway for Monkey VM:** We implemented a compile-time version of this (OpAddInt etc. based on static type tracking). Runtime specialization would be more powerful but adds complexity.

## Stack vs Register: The Real Numbers

For fib(n):
- **Lua (register):** ~8 instructions per call
- **CPython (stack):** ~17 instructions per call
- **Monkey (stack + superinstructions):** ~14 instructions per call

Register VMs generate roughly half the instructions. Since dispatch is the bottleneck, this translates directly to ~2x performance advantage.

## Patterns to Apply

1. **Constant-operand opcodes** — Lua's ADDK/ADDI pattern. ✅ Done in Monkey (OpAddConst etc.)
2. **Superinstructions** — Fuse hot sequences. ✅ Done in Monkey (OpGetLocalAddConst etc.)
3. **Integer fast paths** — Skip type checks for known-int operands. ✅ Done in Monkey (OpAddInt etc.)
4. **Small int cache** — Pre-allocate common integer objects. ✅ Done in Monkey (-1 to 256)
5. **Register architecture** — Would require major rewrite but would halve instruction count. Future consideration.
6. **pc++ metamethod skip** — Elegant but only relevant with operator overloading. Not applicable to Monkey currently.
