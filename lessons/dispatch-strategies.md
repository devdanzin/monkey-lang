# Dispatch Strategies & Opcode Specialization

Deep dive into interpreter dispatch — the actual performance bottleneck in bytecode VMs.

## Why Dispatch Matters

In a bytecode interpreter, the main loop does: fetch instruction → decode → execute → repeat. The "fetch + decode + jump to handler" part is **dispatch**. On modern CPUs, each dispatch is an indirect branch (jump to an address determined at runtime). Branch predictors struggle with these because the target varies per opcode sequence. Result: **dispatch overhead can be 50-80% of total execution time** in simple interpreters.

## Dispatch Strategies (ordered by performance)

### 1. JIT Compilation
Eliminate dispatch entirely by compiling bytecode to native machine code. The "interpreter" becomes a compiler that runs at load/call time.
- **Examples**: V8 (TurboFan), LuaJIT, PyPy, GraalVM
- **Tradeoff**: Enormous complexity. Warmup time. Memory for compiled code.
- **Not applicable to Monkey** (JS-based, can't emit machine code)

### 2. Copy-and-Patch / Template JIT
Pre-compiled machine code templates for each opcode, stitched together at runtime with patched operands. Simpler than full JIT.
- **Examples**: CPython 3.13 (experimental), some Wasm engines
- **Key insight**: Get 80% of JIT performance at 20% of JIT complexity
- **Not applicable to Monkey** (same reason — need native code access)

### 3. Computed Goto / Direct Threading
Instead of a `switch` at the top of a loop, each opcode handler ends with a direct `goto *dispatch_table[next_opcode]`. Eliminates the loop-top branch and helps branch prediction (each opcode has its own indirect branch site with its own prediction entry).
```c
// Instead of:
while (true) { switch (*pc++) { case OP_ADD: ... break; case OP_SUB: ... } }

// Do:
static void* table[] = { &&op_add, &&op_sub, ... };
#define DISPATCH() goto *table[*++pc]
op_add: stack[sp-1] += stack[sp]; sp--; DISPATCH();
op_sub: stack[sp-1] -= stack[sp]; sp--; DISPATCH();
```
- **Examples**: CPython (with GCC/Clang), Ruby (YARV), most production C interpreters
- **Performance**: ~15-25% faster than switch dispatch
- **Not applicable to Monkey** (JS has no goto, no label addresses)

### 4. Switch Dispatch
Simple `switch(opcode)` in a loop. Each iteration: fetch, switch, execute.
- **Examples**: My Monkey VM, CPython (fallback without computed gotos), many hobby VMs
- **Performance**: Baseline. All indirect branches go through one prediction site, causing constant mispredictions.
- **This is what Monkey uses.** Room for improvement within this constraint.

### 5. Call Threading
Each opcode is a separate function. Dispatch = function pointer call.
- **Worst performance**: function call overhead (save/restore registers, stack frame) on top of dispatch overhead.

## What CAN We Do in JavaScript?

Since Monkey's VM runs in JS, we can't use computed gotos or JIT. But we can use:

### A. Opcode Specialization (CPython 3.11 style)
The most promising technique for Monkey. Replace generic opcodes with type-specialized variants at runtime.

**How CPython does it (PEP 659):**
1. Each specializable opcode starts as an "adaptive" version (e.g., `LOAD_ATTR_ADAPTIVE`)
2. Adaptive opcodes count executions. After N executions, they examine the types they've seen
3. If types are consistent, replace the bytecode in-place with a specialized version (e.g., `LOAD_ATTR_INSTANCE`)
4. Specialized opcodes include a **guard** (type check). If the guard fails, they **de-specialize** back to adaptive
5. This is extremely cheap: just overwriting a byte in the bytecode array

**For Monkey VM:**
- `OpAdd` → `OpAddInt` (skip type checking, direct integer addition)
- `OpEqual` → `OpEqualInt` (direct integer comparison)
- `OpGetLocal` + `OpAdd` → could be combined into a superinstruction
- Implementation: add a counter to each instruction site. After 8 hits with same types, mutate the bytecode.
- Guard failure: rewrite back to generic opcode.

**Key insight from PEP 659:** Specialize at individual instruction granularity, not basic blocks or traces. This makes de-optimization trivial (just rewrite one instruction) with no complex state to unwind.

### B. Inline Caching
Store type/dispatch information directly at the call site to avoid repeated lookups.

**The concept:**
- Call sites go through states: uninitialized → monomorphic → polymorphic → megamorphic
- **Monomorphic**: one type seen → cache the method directly, guard on type
- **Polymorphic**: 2-4 types → small cache array, linear scan
- **Megamorphic**: too many types → fall back to generic lookup

**For Monkey VM:**
- Not as relevant (Monkey doesn't have complex method dispatch or prototype chains)
- But could apply to hash table lookups: cache the index for a given key

### C. Superinstructions
Combine frequently occurring opcode sequences into single opcodes.

**For Monkey VM:**
- `OpConstant` + `OpAdd` → `OpAddConst` (load constant and add in one dispatch)
- `OpGetLocal` + `OpConstant` + `OpEqual` + `OpJumpNotTruthy` → common pattern in loops
- Profile bytecode at compile time or after first run, identify hot pairs
- Even combining just the top 5 pairs can reduce dispatch by 10-15%

### D. Quickening
First time a function is called, rewrite its bytecode with optimized versions. Separate "quick" opcodes that skip rarely-needed work (like line number tracking, tracing hooks).

**For Monkey VM:**
- Simplest optimization: "quicken" opcodes that can skip type checks when the function is in a hot loop
- Separate "traced" vs "untraced" bytecode paths

## Applicability to Monkey VM (Priority Order)

1. **Opcode specialization for arithmetic** (high impact, moderate effort)
   - `OpAddInt`, `OpSubInt`, `OpMulInt`, `OpLessInt`, `OpEqualInt`
   - Guard: check if operands are MonkeyInteger, fallback to generic on failure
   - Even without self-modifying bytecode, can do: check types first, fast-path if both int

2. **Constant-operand opcodes** (moderate impact, low effort)
   - `OpAddConst`, `OpSubConst` — encode constant pool index in the opcode
   - Eliminates one stack push + pop per operation
   - Lua does this extensively (ADDK, ADDI, etc.)

3. **Superinstructions for common sequences** (moderate impact, moderate effort)
   - Profile which opcode pairs appear most frequently
   - Implement top 5 as combined opcodes

4. **Inline fast-path for integer arithmetic** (low effort, immediate win)
   - Not even new opcodes — just add `if (typeof left === 'number' && typeof right === 'number')` fast path in existing OpAdd handler before the full object-type dispatch
   - This is essentially manual specialization without bytecode rewriting

## See Also
- `lessons/tracing-jit-compilation.md` — deep dive on tracing JITs (LuaJIT, PyPy, meta-tracing)
- `lessons/vm-internals-lua-cpython.md` — production VM architecture comparison

## Key Takeaway

The hierarchy of interpreter optimization:
1. **Reduce instruction count** (register VM, constant operands, superinstructions)
2. **Reduce dispatch cost per instruction** (computed gotos, threading)
3. **Reduce work per instruction** (specialization, inline caching, quickening)

For a JS-based VM, #1 and #3 are our levers. #2 is locked by the host language. The biggest single win would be specialized arithmetic opcodes, since Monkey programs (especially benchmarks like fibonacci) spend most time in integer arithmetic and comparisons.
