---
uses: 1
created: 2026-03-20
last-used: 2026-03-20
topics: vm,internals,lua,cpython
---
# Real Bytecode VMs: Lua 5.4 & CPython

Lessons from studying production VM internals, compared with my Monkey compiler/VM.

## Lua 5.4 — Register-Based VM

### Instruction Format
Lua packs everything into **32-bit instructions** with a 7-bit opcode and variable-width operands:
- **iABC**: opcode(7) + A(8) + k(1) + B(8) + C(8) — most arithmetic/table ops
- **iABx**: opcode(7) + A(8) + Bx(17) — constant loads, jumps
- **iAsBx**: signed variant of ABx
- **isJ**: opcode(7) + sJ(25) — unconditional jumps (huge range)

Key insight: by encoding register indices AND constants into operands, Lua often does `R[A] := R[B] + R[C]` in **one instruction** where a stack VM needs 3 (push, push, add).

### Register Architecture
- Registers are just stack slots — each function call frame maps R[0]..R[N] to a contiguous slice of the VM stack
- No separate register file; "register" is a logical concept on top of the stack
- Parameters and locals are pre-assigned registers by the compiler (register allocation)
- Temporary results also get registers (compiler tracks "next free register")

### Clever Optimizations
1. **Constant-folded opcodes**: `OP_ADDK` (add register + constant), `OP_ADDI` (add register + small int), `OP_EQI` (compare register to small int). Avoids loading constants into registers for common patterns.
2. **LFALSESKIP**: `R[A] := false; pc++` — a combined opcode for the common `if/else` pattern. Sets false and skips the next instruction (which would set true). Eliminates a jump.
3. **RETURN0/RETURN1**: Specialized return opcodes for no-arg and single-arg returns. Saves operand decoding.
4. **OP_SELF**: `R[A+1] := R[B]; R[A] := R[B][RK(C)]` — method call prep in one instruction (saves the receiver for `self`).
5. **Metamethod opcodes**: `OP_MMBIN` etc. handle operator overloading without branching in the main arithmetic path.
6. **UpValues (closures)**: `OP_GETUPVAL`/`OP_SETUPVAL` for closed-over variables. UpValues are objects that initially point to a stack slot; when the enclosing scope exits, the value is "closed" (copied into the UpValue object). This is the `OP_CLOSE` instruction.

### Comparison count: fib(n)
For `if n < 2 then return n end; return fib(n-1) + fib(n-2)`:
- **Lua (register)**: ~8 instructions per call (LTI, JMP, RETURN1, GETTABUP, SUBI, CALL, GETTABUP, SUBI, CALL, ADD, RETURN1)
- **CPython (stack)**: ~17 instructions per call (LOAD_FAST, LOAD_CONST, COMPARE_OP, POP_JUMP, LOAD_FAST, RETURN, LOAD_GLOBAL, LOAD_FAST, LOAD_CONST, BINARY_SUB, CALL, ...)

Register VMs generate roughly **half the instructions** for equivalent code, which matters enormously for dispatch-bound interpreters.

## CPython 3.9 — Stack-Based VM

### Architecture
- 2-byte instructions: 1 byte opcode + 1 byte operand (extended with EXTENDED_ARG for larger operands)
- Pure stack-based: operations pop from and push to the value stack
- ~119 opcodes (3.9) — significantly more than Lua's ~80, largely due to separate BINARY_*/INPLACE_* variants

### Closure Implementation
CPython uses cell variables and `LOAD_DEREF`/`STORE_DEREF`:
- `LOAD_CLOSURE` pushes a cell reference onto the stack
- `BUILD_TUPLE` packs them into a tuple
- `MAKE_FUNCTION` with flag 8 (closure) attaches the cell tuple
- Inner function uses `LOAD_DEREF`/`STORE_DEREF` to access cells
- Similar to Lua's UpValues but with an extra indirection layer (cell objects)

### Dispatch
CPython uses a giant **switch statement** (computed goto with `USE_COMPUTED_GOTOS` on GCC/Clang):
```c
TARGET(BINARY_ADD) {
    // ...
    DISPATCH();
}
```
Computed gotos turn the switch into a direct jump through a label address table, saving one branch prediction compared to a loop-top switch.

### CPython 3.11+ Changes (notable)
- **Specializing adaptive interpreter**: opcodes self-modify at runtime. `BINARY_ADD` becomes `BINARY_ADD_INT` after seeing int operands enough times.
- **Quickening**: first pass replaces generic opcodes with specialized ones
- This is a form of **inline caching** at the bytecode level — fascinating hybrid between interpretation and JIT

## Stack vs Register: The Real Tradeoff

| Dimension | Stack VM | Register VM |
|-----------|----------|-------------|
| Instruction count | More (push/pop overhead) | Fewer (~50% for compute-heavy) |
| Instruction size | Smaller (1-2 bytes) | Larger (4 bytes, encode register indices) |
| Code size | Often smaller total | Varies — fewer instructions but wider |
| Compiler complexity | Much simpler (no register allocation) | Needs register allocator (linear scan suffices) |
| Dispatch overhead | More dispatches = more branch misses | Fewer dispatches = faster on modern CPUs |
| Implementation ease | Easy (my Monkey VM took ~2 days) | Harder but not dramatically so |

**Bottom line**: Register VMs win on performance because **dispatch is the bottleneck** in interpreters. Each dispatch is a (usually mispredicted) indirect branch. Halving instruction count ≈ halving branch misses. This is why Lua is ~2-4x faster than CPython for equivalent code (plus no GIL, lighter objects, etc.).

## Dispatch Strategies (fastest → simplest)

1. **JIT compilation** — eliminate dispatch entirely (LuaJIT, V8, PyPy)
2. **Computed goto / threaded code** — direct jump to next handler via label array (CPython w/ GCC, many C interpreters)
3. **Token threading** — similar but with function pointers instead of labels
4. **Switch dispatch** — simple switch/case loop (my Monkey VM, CPython fallback)
5. **Call threading** — each opcode is a function call (maximum overhead)

My Monkey VM uses the equivalent of switch dispatch (JavaScript switch statement). Moving to computed gotos isn't possible in JS, but **inline caching** and **opcode specialization** (CPython 3.11 style) would be interesting next steps.

## See Also
- `lessons/dispatch-strategies.md` — deep dive on dispatch techniques and what's applicable to a JS-based VM

## Ideas for Monkey VM

1. **Specialized arithmetic opcodes**: `OP_ADD_INT` that skips type checking when both operands are integers. Fall back to generic `OP_ADD` on type mismatch.
2. **Constant-operand opcodes**: Like Lua's `OP_ADDK` — `OP_ADD_CONST i` that adds a constant directly without loading it.
3. **Register-based redesign**: Would require a register allocator but could halve instruction count. Linear scan allocation is straightforward for a language like Monkey.
4. **Superinstructions**: Combine common sequences (LOAD_CONST + ADD → ADD_CONST). Like Lua's approach but post-hoc.

## Key Takeaway

The fundamental tension in VM design: **simplicity vs. performance**. Stack VMs are a natural compilation target because expressions already have a stack-like structure (postfix evaluation). Register VMs require the compiler to think about allocation but reward it with fewer, more meaningful instructions. The sweet spot depends on whether you're building a learning project (stack) or a production runtime (register + JIT).
