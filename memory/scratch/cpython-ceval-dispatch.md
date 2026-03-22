---
uses: 1
created: 2026-03-21
last-used: 2026-03-21
topics: cpython, ceval, dispatch, vm, interpreter, tail-call, tier2, jit, specialization
---
# CPython ceval.c Dispatch Deep Dive

Source: CPython main (post-3.14), `Python/ceval.c` + `Python/ceval_macros.h` + `Python/generated_cases.c.h`

## Three Dispatch Strategies (Compile-Time Selection)

CPython now supports THREE dispatch mechanisms, selected at compile time:

### 1. Tail Call Dispatch (`_Py_TAIL_CALL_INTERP`) — NEW, fastest
- Each opcode handler is a **separate function** with `Py_PRESERVE_NONE_CC` calling convention
- Dispatch via `Py_MUSTTAIL return handler_table[opcode](args)` — guaranteed tail call
- `preserve_none` CC passes args in registers (not stack), making tail calls nearly free
- Each handler: `PyObject *Py_PRESERVE_NONE_CC _TAIL_CALL_BINARY_OP(TAIL_CALL_PARAMS)`
- TAIL_CALL_PARAMS = `(frame, stack_pointer, tstate, next_instr, instruction_funcptr_table, oparg)`
- Key insight: **better than computed goto** because each handler is a separate function → compiler optimizes each independently, better register allocation, no single massive function
- Requires Clang `preserve_none` + `musttail` attributes (or MSVC 2026+)
- ~15% faster than computed goto in benchmarks

### 2. Computed Goto (`USE_COMPUTED_GOTOS`) — Classic fast path
- GCC/Clang extension: labels as values (`&&TARGET_BINARY_OP`)
- `opcode_targets_table[256]` maps opcode → label address
- Dispatch: `goto *opcode_targets[opcode]`
- Each opcode gets its own branch prediction entry
- All handlers live in one massive function (`_PyEval_EvalFrameDefault` — 3800+ lines)
- `generated_cases.c.h` (12,752 lines!) is `#include`d into this function

### 3. Switch Dispatch — Fallback
- Standard `switch(opcode)` with `case` labels
- Single branch prediction site → constant mispredictions
- Baseline, ~15-25% slower than computed goto

## The Dispatch Macro Stack

```c
DISPATCH()
  → NEXTOPARG()                          // Read next 2-byte instruction
      → word = *(uint16_t*)next_instr    // Atomic load (free-threading!)
      → opcode = word.op.code
      → oparg = word.op.arg
  → PRE_DISPATCH_GOTO()                  // lltrace in debug builds
  → DISPATCH_GOTO()                      // One of the three strategies above
```

Key detail: `FT_ATOMIC_LOAD_UINT16_RELAXED` — even instruction fetch is atomic now, for free-threading (PEP 703 / no-GIL).

## Instruction Format

2-byte `_Py_CODEUNIT`: 1 byte opcode + 1 byte arg. But many instructions use **cache entries** — additional 2-byte slots after the instruction for inline caches. `BINARY_OP` uses 5 cache entries (6 code units total = 12 bytes per instruction).

Cache layout for BINARY_OP:
- `this_instr[0]`: opcode + oparg
- `this_instr[1]`: adaptive counter (specialization trigger)
- `this_instr[2..5]`: reserved for specialized data

## Adaptive Specialization (PEP 659) — The Key Innovation

The BINARY_OP handler contains `_SPECIALIZE_BINARY_OP`:

```c
uint16_t counter = read_u16(&this_instr[1].cache);
if (ADAPTIVE_COUNTER_TRIGGERS(counter)) {
    _Py_Specialize_BinaryOp(lhs, rhs, next_instr, oparg, LOCALS_ARRAY);
    DISPATCH_SAME_OPARG();  // Re-dispatch immediately to the specialized version
}
ADVANCE_ADAPTIVE_COUNTER(this_instr[1].counter);
```

Flow:
1. Generic `BINARY_OP` runs N times, decrementing counter each time
2. When counter reaches 0 → call `_Py_Specialize_BinaryOp`
3. Specializer inspects operand types and **rewrites the opcode in-place**
4. `BINARY_OP` bytecode literally becomes `BINARY_OP_ADD_INT` in memory
5. Future dispatch jumps directly to the specialized handler

De-specialization:
- Specialized handler has type guards: `if (!_PyLong_CheckExactAndCompact(value_o)) { JUMP_TO_PREDICTED(BINARY_OP); }`
- On guard failure → fall back to generic BINARY_OP (which may re-specialize to a different type)
- This is **self-modifying bytecode** at the opcode level

## Specialized Handler Anatomy (BINARY_OP_ADD_INT)

```
1. _GUARD_TOS_INT      — Check top-of-stack is compact int (deopt if not)
2. _GUARD_NOS_INT      — Check next-on-stack is compact int (deopt if not)  
3. _BINARY_OP_ADD_INT  — Call _PyCompactLong_Add (fast path, no allocation for small results)
4. _POP_TOP_INT        — Deallocate right operand (specialized dealloc, no refcount branch)
5. _POP_TOP_INT        — Deallocate left operand
```

Note: Even deallocation is specialized! `_PyLong_ExactDealloc` vs generic `PyStackRef_XCLOSE`. Saves a type check per dealloc.

## Tier 2: Micro-Op Optimizer + JIT

CPython now has a **two-tier** execution model:

### Tier 1: Bytecode Interpreter (ceval.c)
- Standard dispatch loop (tail call / computed goto / switch)
- Adaptive specialization rewrites opcodes
- Hot loops detected via backoff counters on `JUMP_BACKWARD`

### Tier 2: Micro-Op Trace Optimizer
- When a backward jump counter triggers → `_PyJit_TryInitializeTracing()`
- Records a **trace** of micro-operations (uops) along the hot path
- Traces are optimized (constant folding, dead code elimination, type propagation)
- Stored as `_PyExecutorObject` with a trace array of `_PyUOpInstruction`

### Tier 2 Entry: ENTER_EXECUTOR
- Hot loops get their `JUMP_BACKWARD` replaced with `ENTER_EXECUTOR`
- `ENTER_EXECUTOR` looks up the executor for this code position
- Calls `TIER1_TO_TIER2(executor)` which invokes `_Py_jit_entry()`

### JIT (copy-and-patch)
- If `_Py_JIT` is defined: `_Py_jit_entry = _Py_LazyJitShim` (compiles on first call)
- Otherwise: `_Py_jit_entry = _PyTier2Interpreter` (interpreted micro-ops)
- The JIT uses **copy-and-patch**: pre-compiled templates for each uop, stitched together at runtime
- Much simpler than a traditional JIT — no IR, no register allocator, no instruction selection
- Templates compiled at CPython build time, binary-patched with runtime values

### Tier 2 Interpreter (when no JIT)
```c
_PyTier2Interpreter(executor, frame, stack_pointer, tstate) {
    // Has a register-based TOS cache: _tos_cache0, _tos_cache1, _tos_cache2
    // Dispatch via switch(uopcode) in a loop
    // Uops are simpler than bytecode — guards are separate from operations
}
```

### Tier Transitions
- Tier 1 → Tier 2: `TIER1_TO_TIER2()` macro, via `_Py_jit_entry()`
- Tier 2 → Tier 2: `TIER2_TO_TIER2()` for trace-to-trace linking
- Tier 2 → Tier 1: `GOTO_TIER_ONE()` on deoptimization (guard failure)

## Free-Threading Details

Even `NEXTOPARG()` uses `FT_ATOMIC_LOAD_UINT16_RELAXED` — needed because specialization can rewrite bytecode while other threads are reading it. The atomic load ensures no torn reads (opcode from one version + arg from another).

Thread-local bytecode copies (`frame->tlbc_index`) — each thread can have independently specialized bytecode, avoiding contention on specialization counters.

## Key Architectural Insights

1. **Code generation everywhere.** `generated_cases.c.h` (12,752 lines) is auto-generated from a DSL (`Python/bytecodes.c`). Same DSL generates tier 1 handlers, tier 2 uop handlers, and JIT templates. One source of truth.

2. **Three tiers of optimization.** Unspecialized → specialized bytecode → micro-op traces (→ JIT native code). Each tier is more optimized but harder to deopt from.

3. **Deoptimization is cheap.** Bytecode specialization: rewrite one byte. Tier 2 → tier 1: just return a code pointer. This cheapness is what makes speculative optimization viable in an interpreter.

4. **Tail call dispatch is the future.** Eliminates the "one massive function" problem of computed goto. Better codegen, better cache behavior. But requires very specific compiler support.

5. **The instruction is the cache.** Unlike V8's separate inline caches, CPython embeds cache data directly after the instruction in the bytecode array. Zero indirection for cache lookups.

## Comparison with Lua 5.4

| Aspect | CPython (main) | Lua 5.4 |
|--------|----------------|---------|
| Architecture | Stack | Register |
| Instruction size | 2 bytes + N×2 cache | 4 bytes (fixed) |
| Dispatch | Tail call / computed goto / switch | Computed goto / switch |
| Specialization | Adaptive (self-modifying bytecode) | None (static opcodes) |
| JIT | Copy-and-patch (tier 2) | None (LuaJIT is separate) |
| Tiers | 3 (interp → specialized → uop/JIT) | 1 |
| Fib instructions | ~17 per call | ~8 per call |
| Metamethods | Separate handler functions | pc++ skip trick |

CPython compensates for stack VM overhead with sophisticated runtime optimization. Lua compensates for no JIT with a minimal, efficient instruction set. Different philosophies, both effective.

## What This Means for Monkey VM

Our current approach (compile-time specialization, peephole superinstructions) maps to CPython's tier 1 specialization but done statically. The gap:
- We don't have runtime despecialization (our compiler commits to types)
- We can't do trace compilation (JS host limitation)
- Tail call dispatch is impossible in JS (no musttail equivalent)
- But: our static approach has zero warmup cost, which matters for short-lived scripts

If we were to build a register VM, we'd halve instruction count (like Lua) without needing any of CPython's specialization machinery. That's probably the bigger win than trying to replicate CPython's adaptive approach.
