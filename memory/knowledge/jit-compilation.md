# JIT Compilation

Learned from: building a tracing JIT compiler for Monkey language (JS-hosted)

## Key Concepts

- **Tracing JIT architecture:** Profile → Record → Optimize → Compile → Execute. Hot loops detected via back-edge counting (threshold ~16 iterations), then a linear trace of operations is recorded.
- **Meta-tracing in JS:** Can't emit machine code from JS, but CAN generate optimized JS strings that V8/SpiderMonkey will JIT-compile. This eliminates: dispatch overhead, stack push/pop, object wrapping. `new Function()` is the compilation target.
- **Linear SSA-style IR:** Traces produce a flat instruction list where each instruction produces a value referenced by index. Guards cause trace exits on failure. Much simpler than a full CFG-based IR.
- **Guard-based speculation:** Type guards (GUARD_INT, GUARD_BOOL, etc.) let the JIT assume types and operate on raw JS values. When a guard fails, execution falls back to the interpreter at a known state (side exit).
- **Side traces:** When a guard fails repeatedly (HOT_EXIT_THRESHOLD = 8), a new trace is recorded from that exit point. Max 4 side traces per root trace. This handles polymorphic paths without deoptimizing the main trace.
- **Function inlining during tracing:** When the tracer encounters a function call in a hot loop, it can inline the call up to MAX_INLINE_DEPTH (3 levels). The inlined code becomes part of the linear trace.
- **Phi nodes at loop headers:** Merge initial values with back-edge values. Essential for loop-carried dependencies.

## Patterns

- **Hot threshold tuning:** Too low = compile cold code, too high = miss optimization windows. 16 iterations is a good sweet spot for small language VMs.
- **Trace length limiting:** MAX_TRACE_LENGTH = 200 prevents trace explosion in complex loops. Better to have a short, hot trace than a long one that rarely executes.
- **Constant folding on IR:** Much simpler on linear IR than on a graph — single forward pass, replace operands in-place.
- **Dead guard elimination:** If a guard's protected value is never used, the guard can be removed. Reduces trace exits.
- **Cached integer objects:** Pre-allocate common integer objects (like CPython's small int cache) to avoid allocation in hot paths.

## Pitfalls

- **Trace explosion with polymorphic code:** If types vary every iteration, guards fail constantly and you compile tons of short side traces. Need a fallback to interpreter for truly polymorphic paths.
- **Memory management of compiled traces:** Max 64 traces. Old traces need eviction or you leak memory. Implemented a simple LRU but it's imperfect.
- **`new Function()` security concerns:** Generates code from strings — needs careful sanitization of inputs to prevent injection. In a sandboxed language VM this is manageable but worth noting.
- **Deoptimization state:** When a guard fails, you need the full interpreter state (stack, globals, instruction pointer) at the exit point. Recording this state during tracing adds complexity.

## What I Shared

- Commented on CPython issue #146073 with 5 insights from this work:
  1. Trace recording overhead needs careful management
  2. Guard failure counting for side trace generation
  3. Constant folding on linear IR is cheap and high-value
  4. Function inlining decisions during tracing
  5. Trace cache eviction strategies

## Open Questions

- How do production JITs (V8 TurboFan, HotSpot C2) handle trace invalidation when code is patched?
- What's the right heuristic for "this path is too polymorphic, stop trying to trace it"?
- Could a method-based JIT outperform tracing for Monkey's function-heavy patterns?
