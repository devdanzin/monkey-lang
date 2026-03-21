# Dispatch Strategies for Bytecode VMs

Promoted from `memory/scratch/dispatch-strategies.md` (2 uses across 2026-03-20, 2026-03-21).

## Core Insight

In a bytecode interpreter, dispatch (fetch → decode → jump to handler) can be **50-80% of total execution time**. Each dispatch is an indirect branch that CPUs struggle to predict. Reducing dispatch count matters more than reducing per-instruction cost.

## Strategy Hierarchy (fast → slow)

1. **JIT Compilation** — eliminate dispatch entirely (V8, LuaJIT, PyPy)
2. **Copy-and-Patch / Template JIT** — pre-compiled templates stitched at runtime (CPython 3.13). 80% of JIT perf at 20% complexity.
3. **Computed Goto / Direct Threading** — each handler jumps directly to next (`goto *table[next_op]`). Each opcode gets its own branch prediction entry. ~15-25% faster than switch. Requires C/ASM (GCC label-as-value).
4. **Switch Dispatch** — single `switch(opcode)` in a loop. All branches through one prediction site → constant mispredictions. Baseline.
5. **Call Threading** — each opcode is a function pointer call. Worst: adds function call overhead on top of dispatch.

## What Works in JS-Hosted VMs (No Computed Goto, No JIT)

Since we can't use goto or emit native code, our levers are:

### Reduce Instruction Count
- **Constant-operand opcodes**: `OpAddConst` encodes the constant pool index in the instruction, eliminating a separate push. Lua does this extensively (OP_ADDK, OP_ADDI).
- **Superinstructions**: Fuse hot opcode pairs/triples into single opcodes. `OpGetLocal` + `OpConstant` + `OpAdd` → `OpGetLocalAddConst`. Profile bytecode to find top sequences. ~10-15% dispatch reduction.
- **Register VM** (architecture-level): Lua uses ~8 instructions for fib() vs CPython's ~17. Fewer instructions = fewer dispatches.

### Reduce Work Per Instruction
- **Opcode specialization** (CPython PEP 659): Replace generic opcodes with type-specialized variants (`OpAdd` → `OpAddInt`). Guard on type, de-specialize on failure. Specialize at instruction granularity — makes de-optimization trivial (rewrite one byte).
- **Inline caching**: Store type/method info at call site. Monomorphic → polymorphic → megamorphic fallback.
- **Quickening**: Rewrite bytecode on first call with optimized versions that skip tracing hooks, line tracking, etc.

## Monkey VM Results

Applied constant-operand opcodes + superinstructions to the Monkey compiler:
- Fib(25) inner loop: ~18 → ~14 dispatches
- Performance: 85.7ms → 80.4ms (6% improvement)
- VM now 2.06x faster than tree-walking evaluator
- Call overhead dominates fib benchmark — bigger gains expected on loop-heavy code

## Key Takeaway

For any interpreter: (1) reduce instruction count, (2) reduce dispatch cost, (3) reduce per-instruction work. In a JS-hosted VM, only #1 and #3 are available. Biggest single win: specialized arithmetic opcodes for the common integer case.
