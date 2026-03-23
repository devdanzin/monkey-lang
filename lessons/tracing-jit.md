# JIT Compilation Paradigms: Tracing, Copy-and-Patch, Partial Evaluation

> Originally promoted as tracing-jit from scratch on 2026-03-22 (4 uses/3 days).
> Expanded 2026-03-22 (weekly synthesis): merged copy-and-patch-jit (2 uses/2 days), graalvm-truffle-pe (2 uses/2 days).

Three major JIT paradigms for dynamic languages, ordered by complexity:
1. **Copy-and-patch** (CPython 3.13+): memcpy pre-compiled templates, patch in operands. ~4K LOC, 5-9% speedup.
2. **Tracing** (LuaJIT, PyPy): record hot execution paths, compile linear traces. ~60K LOC (LuaJIT), 2-50x speedups.
3. **Partial evaluation** (GraalVM/Truffle): symbolically specialize interpreter on program AST. ~500K LOC, 3-30x speedups.

---

# Part 1: Tracing JIT — LuaJIT and PyPy

A deep dive into trace-based JIT compilation — the technique that makes LuaJIT the fastest dynamic language VM and PyPy a serious Python alternative.

## The Core Idea

Traditional (method-based) JITs compile one function at a time (V8 TurboFan, HotSpot C2). Tracing JITs take a fundamentally different approach: **record the actual execution path through a hot loop, then compile that linear trace to machine code.**

Why this matters: programs spend most time in loops, and loop iterations usually follow similar paths. By recording what *actually happens* rather than what *could happen*, the compiler sees a straight-line sequence with no control flow — trivially optimizable.

## How Tracing Works (Step by Step)

### Phase 1: Profiling
Every loop back-edge and function entry gets a counter. When a counter crosses a threshold (e.g., 56 iterations for loops in LuaJIT, 2x that for function calls), that location becomes a **trace anchor** and recording begins.

### Phase 2: Recording
The interpreter continues executing normally, but every operation is also recorded into a **trace** — a linear sequence of operations in an intermediate representation (IR). Key properties:

- **Function calls are inlined**: if the loop body calls `square(x)`, the trace doesn't record "call square" — it records the body of `square` inline. This eliminates call overhead *and* enables cross-function optimization.
- **Branches become guards**: an `if` statement doesn't create two branches in the trace. The trace follows whichever path was taken, and inserts a **guard** — a cheap check that the condition still holds. If the guard fails, execution "falls off" the trace back to the interpreter.
- **Type information is concrete**: the trace records that `x` was an integer, not that it "might be" an integer. Guards verify this.
- **Recording stops** when execution reaches the loop header again (completing a full iteration).

### Phase 3: Optimization
Traces are **trivially optimizable** because they're linear — no control flow graph, no phi nodes (except at the loop back-edge), no join points. Standard optimizations work with minimal complexity:

- **Dead code elimination**: straightforward on linear code
- **Constant folding**: runtime values are constants in the trace
- **Common subexpression elimination**: linear scan suffices
- **Register allocation**: linear scan is nearly optimal for traces
- **Loop-invariant code motion**: anything that doesn't change between iterations gets hoisted
- **Escape analysis / allocation removal**: objects that don't escape the trace can be scalar-replaced (PyPy is especially good at this — Bolz et al. 2011 showed partial evaluation can remove allocations entirely)

### Phase 4: Code Generation
The optimized trace is compiled to native machine code. Since it's linear, this is far simpler than compiling a full method with its control flow graph.

### Phase 5: Execution
The compiled trace replaces the interpreter for that loop. On each iteration:
1. Execute the compiled machine code
2. At each guard, check the condition
3. If a guard fails → **side exit**: jump back to the interpreter at that point

## LuaJIT: The Masterpiece

Mike Pall's LuaJIT 2.x is widely considered the finest tracing JIT ever built. Key design decisions:

### Dual IR
- **Bytecode** for the interpreter (stack-based, 32-bit instructions like standard Lua)
- **SSA IR** for the JIT (static single assignment — each value defined exactly once)
- The bytecode is compact and fast for interpretation; the SSA IR is optimizable for compilation

### Trace Trees
When a guard fails frequently (indicating a different hot path), LuaJIT records a **side trace** starting from that guard. Over time, a hot loop accumulates a **tree** of traces covering all common paths. This is more sophisticated than a single linear trace — it adaptively discovers the program's actual behavior.

```
TRACE 1: main loop path (most common)
  ├─ guard at if-statement
  │   └─ TRACE 2: the else-branch path (side trace, links back to TRACE 1)
  └─ continues main loop
```

### The Trace Example (from Wikipedia)
```lua
local x = 0
for i=1,1e4 do
    x = x + 11
    if i%10 == 0 then x = x + 22 end
    x = x + 33
end
```

TRACE 1 (main path, `i%10 ~= 0`):
```
0001 int SLOAD #2 CI          -- load i
0002 > num SLOAD #1 T          -- load x (guard: must be number)
0003 num ADD 0002 +11          -- x + 11
0004 int MOD 0001 +10          -- i % 10
0005 > int NE 0004 +0          -- guard: i%10 != 0 (else → side trace)
0006 + num ADD 0003 +33        -- x + 33 (skipped the +22)
0007 + int ADD 0001 +1         -- i + 1
0008 > int LE 0007 +10000      -- guard: i <= 10000 (else → exit)
---- LOOP ----                 -- back to start
```

TRACE 2 (side trace for `i%10 == 0`):
```
0001 num SLOAD #1 PI           -- load x (already proven number)
0002 int SLOAD #2 PI           -- load i
0003 num ADD 0001 +22          -- x + 22
0004 num ADD 0003 +33          -- x + 33
0005 int ADD 0002 +1           -- i + 1
0006 > int LE 0005 +10000      -- guard: i <= 10000
---- stop → links back to TRACE 1
```

Note: the side trace does +22 +33 without the guard (it already knows `i%10 == 0`). Function inlining, type specialization, and guard elimination all happen naturally.

### DynASM
LuaJIT uses DynASM (Dynamic Assembler) — a preprocessor Mike Pall wrote that lets you embed assembly generation in C code. This is how trace compilation is so fast: the code generator is essentially filling in templates with concrete operands. No LLVM, no GCC backend, no complex compiler framework — just direct machine code emission.

### Why It's So Fast
1. **Tiny codebase** (~100K lines of C + ASM vs. millions for V8/HotSpot)
2. **Near-zero warmup**: traces compile in microseconds, not milliseconds
3. **Compact IR**: entire trace fits in cache during optimization
4. **DynASM**: code generation is essentially template filling
5. **Register-based bytecode interpreter** as fallback (already fast before JIT)

### Known Weaknesses (from Cloudflare/King's research)
- **Trace thrashing**: programs with many divergent paths can exhaust the trace cache, causing constant recompilation
- **Run-to-run variability**: non-deterministic profiling means the same program can trace differently each time, leading to 2-3x performance variation
- **NYI (Not Yet Implemented)**: some Lua features force trace aborts, falling back to interpreter. Long-standing NYI list includes some common patterns.
- **Heuristic fragility**: the many interacting heuristics (when to start tracing, when to stop, when to blacklist) are hard to reason about and tune

## PyPy & Meta-Tracing: The Mind-Bending Approach

PyPy takes tracing JIT to its logical extreme: **trace the interpreter, not the user program.**

### The Setup
1. Write a Python interpreter in RPython (a restricted subset of Python)
2. The RPython toolchain automatically generates a tracing JIT for this interpreter
3. When the Python program runs, the JIT traces the *interpreter's execution* — which is itself interpreting the user program
4. The result: compiled machine code that does what the user's Python would do, with the interpreter overhead removed

### Why This Is Brilliant
- **Language-agnostic**: the same technique works for any language. Write an interpreter in RPython → get a JIT for free. This has been done for Scheme, Prolog, and others.
- **Interpreter overhead vanishes**: the trace records what the interpreter *does* (load this value, add these numbers), not the interpreter *loop* (fetch bytecode, decode, dispatch). The dispatch overhead is compiled away.
- **Interpreter = specification**: you write a straightforward interpreter, and the meta-tracer turns it into something fast. You don't need to understand JIT compilation to benefit.

### The Tradeoff
- **Warmup is slow**: meta-tracing must observe enough interpreter iterations to discover the user program's structure. CPython programs start faster than PyPy programs for short-lived scripts.
- **Complexity is hidden, not eliminated**: the RPython toolchain is ~200K lines of code
- **Allocation removal is critical**: since the interpreter creates many temporary objects (bytecode operation results, stack frames), the JIT must be excellent at proving these don't escape and eliminating them. PyPy's escape analysis is world-class for this reason.

### Futamura Projections
Meta-tracing is an instance of the **second Futamura projection**: specializing an interpreter with respect to a program to produce a compiler. The three projections:
1. **First**: specialize an interpreter on a specific program → compiled program
2. **Second**: specialize the specializer on an interpreter → compiler for that language  
3. **Third**: specialize the specializer on itself → compiler generator

PyPy essentially implements the second projection at runtime via tracing.

## Method JIT vs. Tracing JIT: When Each Wins

| Scenario | Method JIT | Tracing JIT |
|----------|-----------|-------------|
| Short-lived programs | ✅ Lower warmup overhead | ❌ Must wait for traces to trigger |
| Tight numeric loops | Both good | ✅ Traces perfectly linear |
| Polymorphic call sites | ✅ Can use inline caches | ❌ Guard failures cause trace exits |
| Many divergent branches | ✅ Compiles all paths | ❌ Trace thrashing |
| Deep call chains in loops | ❌ Each function compiled separately | ✅ Entire chain inlined into trace |
| Large programs | ✅ More predictable | ❌ Many traces, interaction complexity |

### The Industry Trend
V8 (JavaScript) started with a tracing JIT (TraceMonkey in Firefox's SpiderMonkey) but moved to method-based (TurboFan). The industry broadly shifted away from tracing for complex, polymorphic languages like JavaScript. LuaJIT remains the strongest argument for tracing — but Lua's simplicity (one number type, simple tables, no classes) makes it unusually trace-friendly.

## Connections to My Work

### What I Can Apply (from dispatch-strategies.md)
Since Monkey runs in JavaScript, I can't emit machine code. But tracing JIT concepts inform optimization:

1. **Guard-based specialization**: even without JIT, I can use the "record types seen, specialize, guard" pattern for my VM's arithmetic opcodes
2. **Inline caching at instruction granularity**: PEP 659's approach is essentially tracing-lite — each instruction self-modifies based on observed types
3. **Linear trace thinking**: when optimizing hot paths, think about what the actual execution trace looks like, not the control flow graph. What operations actually execute for fib(25)?
4. **Side exit concept**: specialized opcodes that "exit" to generic fallbacks when guards fail — same concept as trace side exits

### What I Can't Apply (but should understand)
- Native code emission (need access to machine code)
- Computed gotos (JavaScript limitation)
- Register allocation (would require redesigning the compiler)
- Actual trace recording and compilation

### The Copy-and-Patch Alternative
CPython 3.13 introduced an experimental **copy-and-patch JIT** — pre-compiled machine code templates for each opcode, stitched together at runtime. It's simpler than tracing JIT but gets meaningful speedups. This is the pragmatic middle ground: harder than interpretation, easier than tracing, surprisingly effective. Worth watching as it matures.

## Key Takeaways

1. **Traces are powerful because they're linear.** No control flow = trivially optimizable. This is the fundamental insight.
2. **Guards are the mechanism for speculation.** Speculate that types/paths stay the same; guard to verify; deoptimize when wrong.
3. **Function inlining comes for free in traces.** The tracer just follows execution across call boundaries.
4. **Meta-tracing is the ultimate abstraction.** Write an interpreter, get a compiler. It's the second Futamura projection made practical.
5. **Tracing has limits.** Polymorphic code, many branches, and non-deterministic profiling create real problems. The industry moved toward method JITs for complex languages.
6. **LuaJIT succeeds because Lua is simple.** One number type, simple tables, minimal dynamism → traces stay stable. Language design and VM design are deeply intertwined.

## Further Reading
- Bolz et al. 2009: "Tracing the Meta-Level: PyPy's Tracing JIT Compiler" (ICOOOLPS '09)
- Bolz et al. 2011: "Allocation Removal by Partial Evaluation in a Tracing JIT" (PEPM '11)  
- Gal et al. 2009: "Trace-based Just-in-Time Type Specialization for Dynamic Languages" (PLDI '09) — TraceMonkey paper
- PEP 659: Specializing Adaptive Interpreter (CPython 3.11+)
- Cloudflare/King's College LuaJIT project (2017+)
- Pall, LuaJIT 2.0 design docs (scattered across mailing list)

## Deep Dive: LuaJIT Trace Recording Internals (from source)

Source: LuaJIT v2.1 (`lj_trace.c`, `lj_record.c`, `lj_jit.h`, `lj_ir.h`, `lj_snap.c`)

### The IR Format (lj_ir.h)

Each IR instruction is a compact `IRIns` struct: opcode (8-bit), type+flags (8-bit), op1 (16-bit ref or literal), op2 (16-bit ref or literal). Constants grow downward from `REF_BIAS`, regular instructions grow upward. This biased indexing means constants and instructions share one array with no branching to distinguish them.

**~90 IR opcodes** organized into categories:
- **Guards**: LT/GE/LE/GT/ULT/UGE/ULE/UGT/EQ/NE + ABC (array bounds check) + RETF
- **Arithmetic**: ADD/SUB/MUL/DIV/MOD/POW/NEG + overflow-checking variants (ADDOV/SUBOV/MULOV)
- **Memory refs**: AREF (array), HREFK (hash const key), HREF (hash), FREF (field), UREFO/UREFC (upvalue open/closed), STRREF, LREF
- **Loads/Stores**: ALOAD/ASTORE, HLOAD/HSTORE, ULOAD/USTORE, FLOAD/FSTORE, XLOAD/XSTORE, SLOAD (stack load — the key one), VLOAD
- **Allocations**: SNEW (string), TNEW (table), TDUP (table dup), CNEW/CNEWI (cdata)
- **Control**: LOOP, PHI, RENAME
- **Type conversions**: CONV, TOBIT, TOSTR, STRTO

Key insight: **SLOAD** is the bridge between the Lua stack and SSA IR. It loads a value from a specific stack slot with mode flags: TYPECHECK (emit a guard for the type), CONVERT (number→int conversion), READONLY (slot won't be modified), PARENT (inherited from parent trace), INHERIT (value available to side traces). This is how the tracer "imports" Lua values into the IR world.

The `emitir(ot, a, b)` macro is how recording works: set up an IR instruction, then pass it through `lj_opt_fold()` — the FOLD optimization pass runs *during recording*, not after. This means constant folding, algebraic simplification, and CSE happen incrementally as the trace is built. Brilliant design: optimization cost is amortized across recording rather than paid all at once.

### Type System

~25 IR types including NIL, FALSE, TRUE, LIGHTUD, STR, THREAD, PROTO, FUNC, CDATA, TAB, UDATA, then numeric: FLOAT, NUM (double), I8, U8, I16, U16, INT, U32, I64, U64. The GUARD flag (0x80) marks an instruction as a guard — if it fails at runtime, execution exits the trace.

### Snapshot System (lj_snap.c, lj_jit.h)

Snapshots are the mechanism for **deoptimization**. Each snapshot captures the state of all Lua stack slots at a specific point in the trace, so that if a guard fails, the interpreter can resume from exactly that point.

```c
typedef struct SnapShot {
  uint32_t mapofs;    // Offset into snapshot map array
  IRRef1 ref;         // First IR ref for this snapshot
  uint16_t mcofs;     // Offset into machine code (for side exit patching)
  uint8_t nslots;     // Number of valid slots
  uint8_t topslot;    // Maximum frame extent
  uint8_t nent;       // Number of compressed entries
  uint8_t count;      // Count of taken exits (for side trace triggering)
} SnapShot;
```

**Compressed snapshot entries** (`SnapEntry` = uint32_t): pack slot number (top 8 bits) + flags (FRAME/CONT/NORESTORE/KEYINDEX) + IR ref (bottom 16 bits). The NORESTORE flag is crucial for performance: slots that haven't been modified since they were loaded don't need to be written back on exit.

The snapshot generation is smart about **elision**: if a slot still holds its original SLOAD value (unmodified, non-inherited), it's skipped entirely. This keeps snapshots compact — most slots are unchanged between iterations.

`snap->count` tracks how many times an exit has been taken. When it hits the `hotexit` threshold (default: 10), a **side trace** is spawned from that exit point. `SNAPCOUNT_DONE` (255) means a side trace has already been compiled and linked.

### Trace Lifecycle (lj_trace.c)

**State machine**: IDLE → START → RECORD → END → ASM → (back to IDLE or ERR)

1. **Hot detection**: Backward jumps (FORL, ITERL, LOOP) and function entries (FUNCF) have hotcounters. When a counter hits 0 (after `hotloop` decrements, default 56), `trace_start()` fires.

2. **trace_start()**: Allocates a trace number, zeros out `J->cur`, sets up the IR/snapshot buffers, calls `lj_record_setup()` to begin recording.

3. **Recording** (`lj_record.c`): Each bytecode instruction is "recorded" — instead of just executing it, the recorder also emits IR instructions via `emitir()`. The `emitir` macro passes through `lj_opt_fold()`, so optimizations happen inline. Recording continues until:
   - The loop header is reached again → `LJ_TRLINK_LOOP` (self-loop)
   - A function return matches the trace start → `LJ_TRLINK_RETURN`
   - Another trace is reached → `LJ_TRLINK_ROOT` or `LJ_TRLINK_STITCH`
   - Recursion detected → `LJ_TRLINK_TAILREC`/`LJ_TRLINK_UPREC`/`LJ_TRLINK_DOWNREC`
   - An error/limit hit → abort

4. **trace_stop()**: Patches the original bytecode to jump directly to the compiled trace:
   - `BC_LOOP` → `BC_JLOOP` (with trace number in D operand)
   - `BC_FORL` → `BC_JFORL` + patches `BC_FORI` → `BC_JFORI`
   - Side traces: `lj_asm_patchexit()` patches the parent trace's machine code exit to jump to the new side trace's machine code
   
5. **Assembly** (`lj_asm.c`): The optimized IR is compiled to machine code via DynASM. Linear scan register allocation (traces are linear → nearly optimal).

### Penalty System

When a trace aborts, the starting bytecode gets a **penalty** — its hotcount is reset to a higher value (doubling each time with some randomness). After enough failures, the bytecode is **blacklisted** by replacing it with an `ILOOP` variant that never triggers tracing again. The penalty cache is a round-robin array of 64 slots.

The randomness (`PENALTY_RNDBITS = 4`) is subtle: it prevents pathological synchronization where the same trace keeps trying and failing at exactly the same intervals.

### Trace Stitching

A newer feature (controlled by `minstitch` parameter, default 0 = disabled): instead of one trace calling a function and recording inline, the trace can "stitch" to another trace. This avoids the function call from bloating the parent trace. `LJ_TRLINK_STITCH` links the parent trace to the child at the call site.

### Key Parameters (from JIT_PARAMDEF)

| Parameter | Default | Purpose |
|-----------|---------|---------|
| maxtrace | 1000 | Max traces in cache |
| maxrecord | 4000 | Max IR instructions per trace |
| maxirconst | 500 | Max IR constants per trace |
| maxside | 100 | Max side traces per root |
| maxsnap | 500 | Max snapshots per trace |
| hotloop | 56 | Iterations before tracing starts |
| hotexit | 10 | Exit count before side trace |
| tryside | 4 | Attempts to compile side trace |
| instunroll | 4 | Max unroll for unstable loops |
| loopunroll | 15 | Max loop unroll in side traces |
| callunroll | 3 | Max unroll for recursive calls |
| sizemcode | 64KB | Machine code area size |
| maxmcode | 2MB | Total machine code limit |

### Optimization Flags (-O)

Level 3 (default) enables: fold, cse, dce, fwd (store-to-load forwarding), dse (dead store elimination), narrow (number→integer narrowing), loop (loop optimization), abc (array bounds check elimination), sink (allocation sinking/removal), fuse (instruction fusion). FMA is available but not default.

### Architectural Insights from Source Reading

1. **The IR is built optimized.** Unlike most compilers (build IR → optimize → emit), LuaJIT runs fold/CSE *during* IR emission. This means the IR is never in an unoptimized state. Fewer passes = faster compilation.

2. **Snapshots are the cost of speculation.** Every guard needs a snapshot (or shares one nearby). The 500-snapshot limit per trace is a real constraint — complex control flow generates many guards, each needing a way to deoptimize. This is why simple loops trace well and complex branchy code doesn't.

3. **Bytecode patching is the entry mechanism.** The interpreter doesn't check "is there a trace for this PC?" on every iteration. Instead, the bytecode itself is rewritten so the normal dispatch path leads directly into the trace. Zero overhead when traces exist; zero overhead when they don't.

4. **The penalty system is evolutionary.** Failed traces don't immediately blacklist — they back off exponentially with jitter. This handles transient failures (e.g., first call hasn't warmed up yet) while eventually giving up on genuinely untraceable code.

5. **Trace linking is direct.** Side traces don't go through any dispatch — `lj_asm_patchexit` literally patches the parent trace's machine code to jump to the child trace's machine code. This is zero-overhead trace-to-trace transitions.

---

# Part 2: Copy-and-Patch — CPython 3.13+

Based on Xu et al. 2021. Instead of building a compiler backend, **pre-compile each operation to machine code at build time**, then at runtime just **copy** the template and **patch** in runtime-specific values. It's a runtime linker.

## How It Works

**Build time** (Tools/jit/): For each micro-op, compile with Clang (`-Os -fno-builtin`), extract machine code bytes + relocations via `llvm-readobj`, store as C arrays. Key flags: `-Os` (not `-O2` — avoids tail-duplication/nop-padding), `-fno-stack-protector`, `-fno-asynchronous-unwind-tables`.

**Runtime** (_PyJIT_Compile): Walk trace, sum stencil sizes, `mmap` contiguous region, for each uop: `memcpy` code + data, patch holes (relocations), advance pointers. Then `mprotect(PROT_EXEC|PROT_READ)`.

**Template design**: `preserve_none` CC + `musttail` returns = continuation-passing style. Each uop tail-calls the next (compiles to direct jump when adjacent). TOS cache passes up to 3 values in registers between uops (poor man's register allocation).

## Key Architectural Insights

1. **Compilation is linking.** JIT "compilation" is just replaying object file relocations at runtime.
2. **Optimize at the right level.** Tier-2 optimizer does constant folding/type propagation; copy-and-patch just lowers to machine code. No second optimization pass needed.
3. **The compiler does the hard work.** Clang at build time handles instruction selection, scheduling, register allocation within each template.
4. **Modest but compounding.** 5-9% over tier-2 interpretation. Compounds with tier-2 optimizer gains (20-40%).
5. **`musttail` + `preserve_none` = elegant dispatch.** The calling convention IS the dispatch mechanism.

## Hole Types & Platform Abstraction

Holes: CODE, DATA, OPARG, OPERAND0/1, JUMP_TARGET, ERROR_TARGET, TARGET. Platform-specific patch functions: x86_64 (patch_32r, patch_64), AArch64 (patch_aarch64_26r/21r/12 + ADRP+LDR fold), i686 (patch_32). GOT eliminated at build time. All uops compile concurrently via asyncio.TaskGroup.

## vs. Other JIT Approaches

- vs. Tracing (LuaJIT): Much simpler (~4K vs ~60K LOC), no cross-uop optimization, no register allocation across ops
- vs. PE (Truffle): ~4K vs ~500K LOC. No global optimization. GraalPy 3-4x > CPython; CPython JIT adds 5-9%
- vs. Interpretation: Eliminates dispatch overhead, instruction decode; enables CPU branch prediction on actual program flow

---

# Part 3: Partial Evaluation — GraalVM/Truffle

**Write an interpreter, get a compiler for free.** Like PyPy's meta-tracing but via partial evaluation: symbolically execute interpreter with a known program AST, constant-fold away interpretation overhead. Produces method-level IR graphs (all paths), not linear traces (one path).

## How It Works

1. **AST interpreter in Java** with `@Specialization`-annotated nodes (inline caching at every node)
2. **Self-specializing execution**: nodes rewrite themselves to match observed types during warmup
3. **Partial evaluation**: when hot, inline all execute() calls (AST nodes are compilation constants), constant-fold tree structure away, leaving only actual computation. This is the **first Futamura projection**.
4. **Graal optimization**: sea-of-nodes IR → escape analysis, GVN, loop opts, speculative optimizations with deopt
5. **Code generation**: register allocation, machine code emission

## Sea-of-Nodes IR

- **Fixed nodes** (control flow): begin, end, if, merge, loop, deopt, invoke
- **Floating nodes** (values): arithmetic, loads, constants — scheduler decides placement
- **Why powerful**: LICM is free (floating nodes naturally hoist), GVN is structural identity, deopt is cheap (frame states are metadata, not maintained on fast path)

## Key Design Decisions

- **AST not bytecode**: tree shape tells compiler operation order; self-specialization is natural on trees. Post-22.1 Bytecode DSL gives fast interpreter mode while preserving PE.
- **`@TruffleBoundary`**: controls PE inlining depth
- **Assumptions**: compiled code depends on runtime invariants; invalidation triggers global deoptimization
- **Polyglot**: cross-language optimization — JS calling Ruby inlined into same compilation unit

## vs. Tracing (PyPy)

| Dimension | Tracing | Partial Evaluation |
|-----------|---------|-------------------|
| Output | Linear traces | Method-level graphs |
| Polymorphism | Guard failures → trace explosion | Speculative specialization + deopt |
| Warmup | Moderate | Slowest (AST interp + PE + Graal) |
| Peak perf | Excellent on loops | Excellent on complex/branchy code |

## Futamura Projections in Practice

- **1st** (Truffle): specialize(interpreter, program) → compiled program. Done at runtime.
- **2nd** (PyPy): specialize(specializer, interpreter) → compiler. Done at build time.
- **3rd**: specialize(specializer, specializer) → compiler generator. Still theoretical.

## See Also
- `lessons/dispatch-strategies.md` — optimization techniques applicable to JS-based VMs
- `lessons/vm-internals-production.md` — production VM architecture comparison
- `lessons/compiler-vm-design.md` — Monkey compiler/VM implementation notes
