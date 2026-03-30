---
uses: 1
created: 2026-03-23
last-used: 2026-03-23
topics: copy-and-patch, jit, cpython, stencils, tos-cache, tier2
---

# Copy-and-Patch JIT: Deep Implementation Details (CPython main branch, March 2026)

## Architecture Overview

The JIT lives in two halves:
1. **Build-time** (`Tools/jit/`): Python scripts that compile each micro-op via Clang, extract object files, generate C stencil arrays
2. **Runtime** (`Python/jit.c`): ~300 lines of C that `mmap` + `memcpy` + patch + `mprotect`

## The Template (`template.c`)

Each micro-op is compiled as a **single function** with signature:
```c
__attribute__((preserve_none)) _Py_CODEUNIT *
_JIT_ENTRY(_PyExecutorObject *executor, _PyInterpreterFrame *frame,
           _PyStackRef *stack_pointer, PyThreadState *tstate,
           _PyStackRef _tos_cache0, _PyStackRef _tos_cache1, _PyStackRef _tos_cache2)
```

Key design: `preserve_none` calling convention + `musttail` returns = continuation-passing style. Each uop tail-calls the next. When stencils are laid out contiguously, the tail call compiles to a **direct fallthrough** (no jump needed). Branches between uops become direct jumps within the allocated region.

## TOS Cache: Poor Man's Register Allocation

**3 register-cached stack slots** (`_tos_cache0/1/2`). These are passed as function parameters (in registers via `preserve_none`), surviving across uop boundaries without memory traffic. This is the JIT's main advantage over interpretation — hot values stay in registers.

Each uop variant is suffixed with register state (e.g., `_BINARY_OP_ADD_INT_r21` = 2 cached inputs, 1 cached output). The tier-2 optimizer assigns these variants.

## Compilation Flow (`_PyJIT_Compile`)

1. **Size calculation pass**: Walk trace, sum `code_size` + `data_size` for each uop's stencil. Also accumulate trampoline and GOT slot requirements via bitmasks.
2. **Single mmap**: Allocate one contiguous region: `[code | trampolines | padding | data | GOT | page-padding]`
3. **Emit pass**: For each uop, call `group->emit(code, data, executor, instruction, &state)` which does `memcpy` of code bytes + data bytes, then patches holes.
4. **Sentinel**: Append `_FATAL_ERROR` stencil at end (guard against buffer overrun).
5. **mprotect**: Mark entire region `PROT_EXEC | PROT_READ` (with i-cache flush on ARM).

Total compilation = O(n) memcpys + O(n*k) patches where k is holes per stencil (typically 3-8).

## Hole Patching

Holes are relocation records baked at build time. Each maps to a patch function:
- **x86_64**: `patch_32r` (PC-relative 32-bit), `patch_64` (absolute), `patch_x86_64_32rx` (relaxable GOT)
- **AArch64**: `patch_aarch64_21r` (ADRP page), `patch_aarch64_12` (page offset), `patch_aarch64_26r` (branch), `patch_aarch64_33rx` (folded ADRP+LDR pair)

The `_stencils.py` `Hole.fold()` method combines ADRP+LDR pairs into a single `patch_aarch64_33rx` when they reference the same value — this is link-time relaxation done at build time.

Hole values include:
- `CODE`/`DATA`: base addresses of current uop's code/data sections
- `OPERAND0`/`OPERAND1`: 64-bit operands (type pointers, constants)
- `JUMP_TARGET`/`ERROR_TARGET`: absolute addresses of other uops in the trace
- `OPARG`: 16-bit argument

GOT slots are deduplicated across the whole trace via bitmask tracking.

## Assembly-Level Optimizer (`_optimizers.py`)

Post-Clang, pre-assembly: operates on textual `.s` files. Optimizations:
1. **Hot block identification**: Blocks reachable from the entry without crossing branches
2. **Branch inversion**: If a conditional branch jumps to a cold block, invert the condition and fall through to the hot path (better branch prediction + code locality)
3. **Redundant jump removal**: If a block ends with a jump to the immediately following block, remove it
4. **Dead block elimination**: Remove unreachable blocks
5. **Small constant folding**: Platform-specific — fold immediate loads into instructions (e.g., AArch64 `movz`+`add` → single `add` with immediate)

This is surprisingly effective because Clang at `-Os` doesn't know about the continuation-passing layout.

## Shim Function

A one-time compiled "shim" bridges the standard C calling convention to the JIT's `preserve_none` convention. Compiled lazily on first executor invocation via `_Py_LazyJitShim`. This means the JIT doesn't need to be initialized at startup — it materializes on demand.

## Key Insights

1. **Compilation is O(n) memcpy + patch** — microseconds, not milliseconds. No optimization passes at JIT time; all optimization is either at build time (Clang) or in the tier-2 optimizer (before JIT).

2. **The tier-2 optimizer is where the real optimization happens.** Copy-and-patch is just the final lowering. Type propagation, constant folding, guard elimination, dead code removal all happen in the tier-2 abstract interpreter before the trace reaches the JIT.

3. **TOS caching is the performance win.** The 5-9% improvement over tier-2 interpretation comes primarily from keeping stack top values in registers across uop boundaries.

4. **GOT deduplication matters.** Without it, every uop referencing `_PyLong_Add` would get its own GOT slot. The bitmask approach shares one slot per symbol across the entire trace.

5. **The assembly optimizer compensates for Clang's ignorance.** Clang compiles each template as an independent function. The post-Clang optimizer knows they'll be laid out sequentially and optimizes accordingly (branch inversion, jump removal).

6. **Max code size is 1MB.** `PY_MAX_JIT_CODE_SIZE = (1 << 20) - 1`. This constrains trace length and prevents runaway compilation.

7. **The design is deliberately boring.** No register allocation across uops (just TOS cache), no instruction scheduling, no loop optimization. The thesis: compiler infrastructure complexity is the enemy; let Clang do the hard work per-template, then just stitch.

## Comparison Notes for Monkey JIT

My JIT does real tracing + optimization (SSA IR, store-to-load forwarding, LICM, etc.) — it's architecturally more like LuaJIT. Copy-and-patch would be the wrong choice for Monkey because:
- We already have a working optimizer pipeline that gets 9.5x speedups
- Copy-and-patch's value proposition is *simplicity* over *performance*
- But the TOS cache concept is interesting — could cache top-of-stack in virtual registers in my IR

## CPython JIT Optimizer Architecture (March 2026 update)

### Pipeline
1. **Trace frontend**: records micro-op (uop) sequences from tier 1 bytecode
2. **Abstract interpretation** (`optimizer_analysis.c`): single-pass forward walk over uops, tracking symbolic types (JitOptRef). Each uop case (`optimizer_cases.c.h`, auto-generated from `optimizer_bytecodes.c`) updates the abstract state and either emits the uop or eliminates it.
3. **Peephole** (`remove_unneeded_uops`): cancels push/pop pairs, removes unnecessary `_SET_IP` and `_CHECK_VALIDITY` instructions
4. **Copy-and-patch codegen** (`jit.c`): concatenates pre-compiled stencils for each uop, patches constants/addresses

### Key Design Choices
- **No separate IR**: optimizes uops in-place (vs Monkey JIT's separate IR stage)
- **Abstract interpreter does type propagation + constant folding + guard elimination in one pass**
- **Bloom filter for dependencies**: tracks which global dicts/types the trace depends on, for invalidation
- **Contradiction detection**: if abstract interpretation reaches an impossible state, bail out
- **Escape tracking**: `HAS_ESCAPES_FLAG` marks uops that might escape to Python code, gates `_CHECK_VALIDITY` insertion

### Contribution Surface
- `optimizer_bytecodes.c`: adding type propagation rules for new uops (e.g., #146381 folding dict subscript for promoted constants)
- Trace fitness (#146073): heuristics in the trace frontend for when to stop tracing
- Guard optimization: eliminating redundant type checks when the abstract interpreter proves the type

---

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
