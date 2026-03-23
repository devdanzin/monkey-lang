---
uses: 2
created: 2026-03-21
last-used: 2026-03-22
topics: copy-and-patch, jit, cpython, compilation, stencils, templates
---
# Copy-and-Patch JIT Compilation

The technique behind CPython 3.13+'s experimental JIT. Based on Xu et al. 2021 ("Copy-and-Patch Compilation").

## The Core Idea

Instead of building a traditional compiler backend (instruction selection → register allocation → code emission), **pre-compile each operation to machine code at build time**, then at runtime just **copy** the pre-compiled template and **patch** in the runtime-specific values (operands, jump targets, addresses).

It's like a linker that runs at JIT time. The "compilation" is just memcpy + fixup.

## How It Works (CPython Implementation)

### Build Time (Tools/jit/)

1. For each micro-op (uop) in the tier-2 instruction set, compile `template.c` with `-D_JIT_OPCODE=<uop_name>` using Clang
2. `template.c` contains a single function `_JIT_ENTRY` that includes a switch on the uop code — but since the opcode is a compile-time constant, the compiler eliminates the switch and generates code for just that one uop
3. Extract the resulting machine code bytes (the "stencil") and the relocation entries (the "holes") from the object file using `llvm-readobj`
4. Store all stencils + hole descriptions as C arrays in auto-generated `jit_stencils.h`

Each stencil has:
- **code body**: raw machine code bytes for that uop
- **data section**: read-only constants used by the code
- **holes**: locations within code/data that need runtime patching, with what value to patch (operand, jump target, symbol address, etc.)

### Runtime (_PyJIT_Compile in jit.c)

When a tier-2 trace is ready for JIT compilation:

1. **Size calculation**: Walk the trace, sum up `code_size` and `data_size` for all uops (each stencil has known fixed size)
2. **Allocate**: `mmap` a single contiguous region (code + trampolines + data + GOT, page-aligned)
3. **Emit**: For each uop in the trace, call `group->emit(code, data, executor, instruction, &state)`:
   - Copies the stencil bytes to the output buffer
   - Patches each hole with the runtime value (operand, jump target address, symbol address)
   - Advances the code/data pointers
4. **Protect**: `mprotect(PROT_EXEC | PROT_READ)` — make executable, remove write permission
5. Store the pointer in `executor->jit_code`

The `emit` function is auto-generated per-stencil. It's literally:
```c
memcpy(code, stencil_bytes, sizeof(stencil_bytes));
memcpy(data, stencil_data, sizeof(stencil_data));
patch_32r(code + 15, jump_target);  // Fix up a relative jump
patch_64(data + 8, operand0);       // Fix up an operand reference
...
```

### The Template (template.c)

The template function signature uses `preserve_none` calling convention + `musttail` returns:

```c
__attribute__((preserve_none)) _Py_CODEUNIT *
_JIT_ENTRY(executor, frame, stack_pointer, tstate,
           _tos_cache0, _tos_cache1, _tos_cache2)
```

Key design: **continuation-passing style**. Each uop template ends with a `musttail` call to the next template. This means:
- No interpreter dispatch loop in JIT code
- Each uop falls through to the next via tail call (which the compiler optimizes to a direct jump when templates are adjacent)
- Deoptimization (`GOTO_TIER_ONE`) just returns to tier 1

Runtime values are accessed through `PATCH_VALUE` macros:
```c
PATCH_VALUE(uint64_t, _operand0_64, _JIT_OPERAND0)
```
These become loads from known offsets that the hole-patching fills in at JIT time.

### Hole Types

The `HoleValue` enum defines what can be patched:
- `CODE` — base address of this uop's machine code
- `DATA` — base address of this uop's read-only data
- `OPARG` — the uop's argument
- `OPERAND0/1` — 64-bit operand values
- `JUMP_TARGET` — address of another uop's compiled code (for branches)
- `ERROR_TARGET` — address of the error handler uop
- `TARGET` — tier-1 bytecode target (for deoptimization)

Platform-specific patch functions handle different relocation types:
- x86_64: `patch_32r` (RIP-relative), `patch_64` (absolute)
- AArch64: `patch_aarch64_26r` (branch), `patch_aarch64_21r` (ADRP page), `patch_aarch64_12` (page offset)

## Why This Approach?

### vs. Traditional JIT (V8 TurboFan, HotSpot C2)
- **Radically simpler**: no IR, no register allocator, no instruction selection, no scheduling
- **Fast compilation**: just memcpy + patch, O(n) in trace length
- **Leverages existing compiler**: Clang does all the hard optimization work at build time
- **Portable**: same Python build script works for x86_64, AArch64, Windows, Linux, macOS
- **Downside**: can't do cross-uop optimization (register allocation across operations, constant propagation between uops) — each stencil is independently compiled

### vs. Tracing JIT (LuaJIT)
- **Much simpler to implement**: ~2000 lines of C + ~2000 lines of Python build script vs. LuaJIT's ~60K lines of hand-tuned C+ASM
- **No IR construction**: traces are already in uop format; just stitch the templates
- **No cross-operation optimization**: LuaJIT's IR allows CSE, DCE, LICM across the whole trace. Copy-and-patch treats each uop independently at the machine code level
- **No register allocation across ops**: each stencil manages its own registers; values pass through memory (stack pointer) between uops. LuaJIT does linear-scan allocation across the entire trace
- **Good enough?**: CPython's tier-2 optimizer already does constant folding, type propagation, and dead code elimination at the uop level. Copy-and-patch just needs to turn each optimized uop into machine code.

### vs. Interpretation
- Eliminates dispatch overhead (computed goto / switch)
- Eliminates instruction decode (opcode bytes are baked into templates)
- Enables CPU branch prediction to work on the actual program flow (not the interpreter's dispatch branches)
- CPython benchmarks show ~5-9% speedup over tier-2 interpreter (modest but real)

## The TOS Cache: Register Allocation Lite

CPython's JIT passes up to 3 values in registers between uops via `_tos_cache0/1/2`. This is a poor man's register allocation:
- Values at the top of the Python stack stay in CPU registers across uop boundaries
- The `preserve_none` calling convention means these registers survive `musttail` calls
- Uop variants exist for different cache depths (e.g., `_BINARY_OP_ADD_INT_r21` = read 2, write 1)

This partially compensates for the lack of cross-uop register allocation.

## Comparison with Xu et al. (Original Paper)

The 2021 paper by Haoran Xu and Fredrik Kjolstad proposed copy-and-patch for:
- WebAssembly compilation (replacing Liftoff in V8)
- Lua compilation

Key differences from CPython's implementation:
- Paper focused on compiling from an AST or bytecode directly; CPython applies it to an *already-optimized* uop trace
- Paper's prototype used LLVM object files as templates; CPython does the same but with much more engineering polish
- CPython adds the TOS cache / `preserve_none` CC / `musttail` CPS pattern for zero-overhead dispatch between stencils

## Architectural Insights

1. **Compilation is linking.** The fundamental insight: if you pre-compile templates with symbolic holes, JIT "compilation" is just symbol resolution — exactly what a linker does. Copy-and-patch makes this explicit.

2. **Optimize at the right level.** CPython optimizes at the uop IR level (tier-2 optimizer), then uses copy-and-patch just to lower optimized uops to machine code. No need for a second optimization pass at the machine code level.

3. **The compiler does the hard work.** By running Clang at build time with `-Os`, each template gets full compiler optimization — instruction selection, scheduling, register allocation within the template. Only cross-template optimization is lost.

4. **W^X is trivial.** Write all code, then flip to executable. No incremental code patching needed (unlike LuaJIT's `lj_asm_patchexit`).

5. **Modest but compounding gains.** 5-9% over tier-2 interpretation doesn't sound huge, but it compounds with the tier-2 optimizer's gains (which can be 20-40% on optimizable code). The JIT also enables future optimizations (better register allocation, instruction fusion) without changing the architecture.

6. **`musttail` + `preserve_none` = continuation passing machine code.** Each template is a continuation that tail-calls the next. Adjacent continuations compile to fallthrough. This is elegant — the calling convention *is* the dispatch mechanism.

## What This Means for Monkey VM

Copy-and-patch isn't applicable to our JS-hosted VM (we can't emit machine code). But the *conceptual* lessons apply:

1. **Template-based code generation**: even in a JS VM, we could pre-build optimized JS functions for common uop sequences and stitch them together (eval-based JIT, though V8 would need to compile them)
2. **Separate optimization from lowering**: our compiler can optimize at the bytecode level; the VM just executes the result. Don't mix concerns.
3. **TOS caching in software**: we could keep top-of-stack in local variables (which V8 will register-allocate) instead of always going through the stack array

## Deep Dive: Stencil Extraction Pipeline (from CPython source)

The build-time pipeline lives in `Tools/jit/` and is surprisingly elegant. Read from the actual source (2026):

### Step 1: Per-Uop Compilation (`_targets.py._compile()`)

For each micro-op, CPython writes a **separate C file** containing `template.c` with only that uop's case inserted. Key Clang flags:

- **`-Os`** (not `-O2`/`-O3`): `-O2` includes tail-duplication and nop-padding for jump alignment — counterproductive when stencils are laid end-to-end. `-Os` generates better stencil code.
- **`-fno-builtin`**: prevents Clang from replacing code with calls to `memset`/`memcpy` that can't be found at JIT time.
- **`-fno-stack-protector`**: no stack canary calls to resolve.
- **`-fno-asynchronous-unwind-tables`**: no `.eh_frame` bloat in stencils.
- **`-S` first, then `-c`**: compile to assembly first (for the optimizer pass to clean up), then assemble to `.o`.

Between `-S` and `-c`, a Python `Optimizer` pass runs on the assembly to remove labels, globals, and other artifacts that would create unnecessary relocations.

### Step 2: Object File Parsing (`_targets.py._parse()`)

Uses `llvm-readobj --elf-output-style=JSON` to extract structured data from the `.o` file:
- **Section data** (the raw bytes — the stencil body)
- **Section relocations** (where the holes are)
- **Section symbols** (what the holes reference)

Also runs `llvm-objdump --disassemble --reloc` for human-readable disassembly (stored in `StencilGroup` for debugging).

The JSON output needs fixups — Mach-O and COFF have quirks (`PrivateExtern` noise, extra brackets). CPython patches these with string replacements before `json.loads()`.

### Step 3: Stencil + Hole Construction (`_stencils.py`)

A `StencilGroup` has two `Stencil`s: **code** (executable) and **data** (read-only constants).

Each `Hole` records:
- **offset**: byte position in the stencil to patch
- **kind**: relocation type (platform-specific, e.g., `R_X86_64_64`, `ARM64_RELOC_BRANCH26`)
- **value**: what HoleValue base to use (`CODE`, `DATA`, `OPARG`, `OPERAND0`, `JUMP_TARGET`, etc.)
- **symbol**: optional symbol name to add to the base
- **addend**: constant offset

The `kind` maps to a **patch function** via `_PATCH_FUNCS` — a comprehensive table covering:
- x86_64: `patch_64` (absolute 64-bit), `patch_32r` (RIP-relative 32-bit), `patch_x86_64_32rx` (GOT-relative, relaxable)
- AArch64: `patch_aarch64_26r` (branch ±128MB), `patch_aarch64_21r` (ADRP page), `patch_aarch64_12` (page offset), `patch_aarch64_16a/b/c/d` (MOVW immediate fragments)
- i686: `patch_32` (absolute 32-bit)

### Step 4: GOT Elimination (`process_relocations()`)

GOT (Global Offset Table) references are resolved at build time. The build script knows the addresses of all CPython runtime symbols, so GOT entries become direct DATA-relative references. This means JIT code doesn't need a real GOT — all "global" lookups are resolved during stencil emission.

### Step 5: AArch64 Hole Folding

`Hole.fold()` combines adjacent AArch64 ADRP+LDR pairs (page calculation + page-offset load) into a single `patch_aarch64_33rx` operation. This is a relaxation optimization — if the target is within range, the pair can be simplified.

### Step 6: C Code Generation (`_writer.py`)

The final output is `jit_stencils.h` — a C header with:
- `static const unsigned char stencil_bytes_<OPNAME>[] = { 0x48, 0x89, ... };`
- `static const unsigned char stencil_data_<OPNAME>[] = { ... };`
- `static void emit_<OPNAME>(...)` functions that: memcpy code, memcpy data, call patch functions

Each `Hole.as_c()` generates a line like:
```c
patch_32r(code + 0x15, (uintptr_t)&_PyLong_Add + -0x4);
patch_64(data + 0x8, instruction->operand0);
```

### Key Insight: The "Holes" Are Just Relocations

The entire system is a **runtime linker**. Object files already contain exactly the information needed: "at offset X, patch in the address of symbol Y with relocation type Z." CPython just reads this information, stores it as data, and replays the linking step at JIT time. The genius is recognizing that a JIT compiler doesn't need to *generate* machine code — it just needs to *link* pre-generated code.

### Platform Abstraction

The same Python build pipeline handles ELF (Linux), Mach-O (macOS), and COFF (Windows) by:
1. Using `llvm-readobj` (which parses all three) with JSON output
2. Having per-platform `_handle_section()` and `_handle_relocation()` methods
3. Mapping platform-specific relocation types to platform-specific patch functions

This means adding a new platform is mostly: add relocation type mappings + patch function implementations.

### Async Build Pipeline

`_build_stencils()` compiles all uops **concurrently** using `asyncio.TaskGroup`. Each uop is independent (separate `.c` file), so they can all compile in parallel. On a multi-core machine, this makes the build fast despite compiling ~300 separate files.

## See Also
- `memory/scratch/tracing-jit-compilation.md` — how LuaJIT's full tracing JIT works (the sophisticated alternative)
- `memory/scratch/cpython-ceval-dispatch.md` — CPython's tier-1 dispatch + tier-2 architecture
- Xu & Kjolstad 2021: "Copy-and-Patch Compilation" (OOPSLA '21)
- PEP 744: JIT Compilation (CPython)
- Brandt Bucher's talks on CPython JIT (PyCon US 2024, 2025)
