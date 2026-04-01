# Tracing JIT Compilation

Promoted from: scratch/side-trace-design, scratch/meta-jit-v8-analysis, scratch/allocation-sinking-deep, scratch/guard-elimination-known-types
Source project: Monkey language JIT compiler

## Architecture (proven in Monkey)

**Pipeline:** Profile back-edges → Record linear trace → Optimize IR → Compile to JS via `new Function()` → Execute, fall back on guard failure

**Key numbers:** HOT_LOOP_THRESHOLD=16, MAX_TRACE_LENGTH=200, MAX_TRACES=64, HOT_EXIT_THRESHOLD=8 for side traces

## Core Patterns

1. **Guard-based speculation:** Assume types (GUARD_INT, GUARD_BOOL), operate on raw values. Guard failure → side exit to interpreter with full state snapshot.

2. **Side traces:** When a guard fails HOT_EXIT_THRESHOLD times, record a new trace from that exit point. VM-dispatched (not parent-patched, since we can't patch JS `new Function()` output). Max 4 per root trace.

3. **Variable promotion:** Keep hot values as raw JS primitives in traces, only box to MonkeyObject at trace exits. This IS allocation sinking, specialized for the common case.

4. **Meta-JIT collaboration:** Monkey eliminates interpreter dispatch + object boxing + type checks. V8/TurboFan then adds register allocation + instruction selection + Smi overflow guards. Two layers complement, rarely fight. ~10-20% overhead vs native, 1% implementation effort.

5. **Abort blacklisting:** Untraceable patterns (deep recursion, extreme polymorphism) get blacklisted after repeated failures. Prevents negative JIT overhead. Borrowed from LuaJIT's penalty system.

## Optimization Passes (in order)

1. Constant folding on linear IR (single forward pass, trivial)
2. Dead guard elimination (guard protecting unused value → remove)
3. Store-to-load forwarding (load after store to same slot → use stored value)
4. Loop-invariant code motion (hoist loads/guards above loop when provably safe)
5. Escape analysis (array push pattern: create→push→return → in-place mutation, O(n²)→O(n))
6. Guard elimination via type propagation (if GUARD_INT passed, skip redundant GUARD_INT on same value)

## Pitfalls

- **Trace explosion with polymorphic code:** Types vary every iteration → constant guard failures → too many short side traces. Need interpreter fallback.
- **Pre-loop guard codegen:** LICM hoists guards above the loop, but codegen assumed all guards use in-loop side-trace dispatch. Pre-loop guards need different exit handling.
- **Deoptimization state complexity:** Guard exits need full interpreter state (stack, globals, IP). Snapshot recording during tracing adds ~15% recording overhead.
- **V8 interference:** `new Function()` prevents V8 from inlining across trace boundaries. Closure captures (__globals, __consts) are extra indirections V8 can't fully optimize away.

## Key Insight

A full tracing JIT is buildable in one day IF you've done source-level research on LuaJIT/CPython/GraalVM first. Research on Day N enables massive build velocity on Day N+1. The research → build pipeline is the meta-pattern.

## vs Copy-and-Patch

Copy-and-patch (CPython 3.13): O(n) memcpy, pre-optimized stencils, compiles everything including cold code. Gets 2-9% speedup.
Tracing JIT (Monkey): custom optimization per trace, only hot paths, gets 10-38x on hot loops. 
Trade-off: simplicity vs peak performance. For a JS-hosted JIT, tracing wins because `new Function()` compilation cost means you want fewer, more optimized traces.
