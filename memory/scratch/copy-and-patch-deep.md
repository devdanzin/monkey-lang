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
