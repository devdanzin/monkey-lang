---
uses: 1
created: 2026-03-26
last-used: 2026-03-26
topics: jit, copy-and-patch, compilation, cpython, stencils, wasm
---

# Copy-and-Patch Compilation

## Core Idea (Haoran Xu, 2021)
Pre-compile machine code "stencils" for each bytecode/operation at build time (using LLVM or Clang). At runtime, just:
1. **Copy** the appropriate stencil into the code buffer
2. **Patch** the "holes" (relocations) with actual values (constants, jump targets, pointers)

No IRs, no register allocation, no instruction selection, no scheduling. Just memcpy + patch.

## Why It's Fast
- **Compilation speed:** Orders of magnitude faster than LLVM. The compiler is essentially a fancy memcpy.
  - Xu's paper: 2 orders of magnitude faster than LLVM -O0
  - CPython JIT: "negligible compilation cost"
- **Code quality:** The stencils are pre-optimized by LLVM at build time. So runtime code is LLVM-quality.
- **Simplicity:** No IR needed. No optimization passes. The quality comes from stencil pre-optimization.

## How Stencils Work
1. At build time, for each bytecode op (e.g., BINARY_ADD):
   - Write a C function implementing it
   - Compile to machine code with LLVM
   - Extract the binary bytes
   - Record relocation holes (where operands/addresses go)
2. Store in a "stencil library" (binary blob + relocation metadata)
3. At runtime:
   - For each bytecode op, copy its stencil into executable memory
   - Patch the holes with concrete values
   - Chain stencils together (each ends with a jump to the next)

## CPython 3.13 JIT Architecture
- Tier 1: CPython bytecode interpreter (existing)
- Tier 2: "Micro-op" interpreter (new in 3.13) — traces through bytecodes, records micro-ops
- Tier 2 JIT: Copy-and-patch on micro-op traces
- Uses Clang to pre-compile ~300 micro-op stencils at CPython build time
- Runtime: copies stencils, patches, makes executable
- Current status: experimental (--enable-experimental-jit), ~2-9% speedup

## Copy-and-Patch vs Tracing JIT (Our Approach)

| Aspect | Copy-and-Patch | Tracing JIT |
|--------|---------------|-------------|
| **Compilation speed** | Ultra-fast (memcpy) | Moderate (IR construction, optimization passes) |
| **Code quality** | Pre-optimized stencils | Custom-optimized per trace |
| **Optimization scope** | Per-operation (local) | Per-trace (global — cross-op optimization) |
| **Key optimizations** | Stencil-level LLVM opts | Store-load forwarding, guard elim, LICM, CSE, inlining |
| **Handles** | Any bytecode sequence | Hot loops/paths |
| **Weakness** | Can't optimize across operations | Compilation overhead, cold code not compiled |
| **Best for** | Quick speedups everywhere | Hot loops with maximum speedup |
| **Target** | Native machine code | JavaScript (in our case) or native |

### Key Difference: Optimization Scope
Copy-and-patch optimizes each stencil in isolation. A BINARY_ADD stencil is optimal for addition, but it doesn't know about the surrounding operations. Our tracing JIT sees the entire hot path and can:
- Eliminate redundant loads/stores between operations
- Hoist loop-invariant code
- Eliminate type guards based on path knowledge
- Inline function calls
- Constant-fold across operations

This is why our JIT gets 10x+ on hot loops while C&P typically gets 2-5x.

### Key Advantage: Copy-and-patch optimizes EVERYTHING
Our tracing JIT only helps hot loops. Cold code runs at interpreter/VM speed. Copy-and-patch can compile everything, including cold paths, with minimal overhead. For workloads with many small functions and little loop heat, C&P wins.

## Could We Add Copy-and-Patch to Monkey?

**Challenge:** We target JavaScript, not native code. Copy-and-patch requires native machine code stencils. We'd need:
1. A way to emit native code from JavaScript (not possible without native modules)
2. OR: a "JavaScript stencil" approach — pre-generate JS code templates for each opcode and string-concatenate them at runtime

**JS Stencil Approach:**
```javascript
const stencils = {
  OpAdd: 'const r$ID = __stack[--__sp - 1].value + __stack[__sp].value; __stack[__sp - 1] = new __MonkeyInteger(r$ID);',
  OpConstant: 'const r$ID = __consts[$VAL]; __stack[__sp++] = r$ID;',
  // ...
};
```
This is essentially what our code generator already does — but without the optimization passes. Our JIT builds custom code for the specific trace; C&P would build generic code from templates.

**Verdict:** For our JS-hosted JIT, the tracing approach is better. C&P makes sense for native-code targets where memcpy is the bottleneck. In JS, `new Function()` compilation is the bottleneck, and reducing code size (via optimization) actually makes it faster.

## Notable Implementations
1. **Haoran Xu's paper** (2021) — SQL queries, WebAssembly
2. **CPython 3.13** (2024) — experimental JIT for Python bytecode
3. **Bun's JSC** uses a similar approach for its baseline JIT tier

## Connection to V8 Sparkplug
V8's Sparkplug compiler (baseline tier) is conceptually similar: it emits machine code directly from bytecode without optimization, using pre-written code sequences for each bytecode. The difference: Sparkplug uses hand-written assembly templates, not LLVM-compiled stencils. But the principle is the same: skip optimization, just emit code fast.
