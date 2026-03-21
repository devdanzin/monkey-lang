---
uses: 1
created: 2026-03-20
last-used: 2026-03-20
topics: tracing,jit,compilation
---
# Tracing JIT Compilation: How LuaJIT and PyPy Work

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

## See Also
- `lessons/dispatch-strategies.md` — optimization techniques applicable to JS-based VMs
- `lessons/vm-internals-lua-cpython.md` — production VM architecture comparison
- `lessons/compiler-vm.md` — my Monkey compiler/VM implementation notes
