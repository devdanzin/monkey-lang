---
uses: 1
created: 2026-03-22
last-used: 2026-03-22
topics: deoptimization, jit, v8, graal, truffle, on-stack-replacement, guards
---

# Deoptimization in Production JITs

The inverse of JIT compilation: jumping from optimized code back to interpreted/unoptimized code, restoring full interpreter state.

## Why It Matters
Deoptimization is what makes *speculative optimization* safe. Instead of checking every possible edge case in compiled code (overflow, type changes, method redefinition), you optimistically assume the common case and deoptimize if wrong. This dramatically simplifies generated code.

## V8 (TurboFan) Approach

### Eager vs Lazy Deoptimization
- **Eager:** Guard fails during execution → immediately deoptimize (type guard fails, overflow, out-of-bounds)
- **Lazy:** Code is *marked* for deoptimization (e.g., method redefined, map transition) but actual deopt happens on next invocation
- **Lazy unlinking (2017):** Instead of maintaining weak lists of all optimized functions and iterating on deopt, V8 now checks a `marked_for_deoptimization` bit in the code object prologue. If set, jumps to `CompileLazyDeoptimizedCode` builtin which resets the function's code pointer to the interpreter trampoline. Eliminated GC overhead from maintaining linked lists of optimized functions. Saved ~170KB on facebook.com (3.7% memory reduction from removing `next` pointer per JSFunction).

### Deopt Metadata
- FrameStates in TurboFan IR capture interpreter state at each potential deopt point
- Maps optimized registers/stack slots back to interpreter frame layout
- Polymorphic access: decision tree with fallback to generic op (megamorphic) instead of deopt

### Monomorphism Matters
- Monomorphic: single type guard + specialized op → can eliminate redundant guards
- Polymorphic: decision tree of 2-4 shapes → weaker guarantees, less redundancy elimination  
- Megamorphic: generic fallback (no deopt, but slow)

## HotSpot (JVM) Approach
- On-Stack Replacement (OSR): can enter *and exit* optimized code mid-method
- Uncommon traps: deopt points compiled as calls to VM runtime
- Safepoints: well-defined points where thread state is consistent for GC and deopt
- Deopt reasons tracked and used to avoid re-optimizing with same speculation

## Graal/Truffle Approach (Most Aggressive)
Truffle uses deoptimization *pervasively* — it's the core mechanism that makes high-level interpreters fast:

### Key Insight: Deopt Replaces All Runtime Checks
Instead of checking for edge cases in compiled code:
1. **Fixnum→Bignum overflow:** `deoptimize! if overflowed?` — no Bignum code path in compiled code at all
2. **Monkey patching:** No check needed! Redefining a method *triggers* deopt of all affected compiled code. Zero overhead in hot path.
3. **#binding:** Deopt reconstructs stack-allocated/scalar-replaced values back into heap objects
4. **ObjectSpace:** Force deopt of all threads → all objects materialized on heap → walk heap
5. **set_trace_func:** Inlined no-op method; installing trace = "redefining" it → triggers deopt
6. **Thread#raise:** Conceptually same as method redefinition

### Partial Escape Analysis
Objects allocated on stack (scalar replacement). On deopt, values extracted from stack and materialized as heap objects. "We know where everything is because we put it there."

### Transfer to Interpreter
Truffle nodes have `transferToInterpreterAndInvalidate()` — deoptimizes current compilation, ensures node is re-profiled before next compilation. AST rewrites happen in interpreter, then recompile with new specialization.

## My Monkey JIT: Comparison
Current approach: guards + side traces (like LuaJIT). No true deoptimization — guard failure falls back to VM dispatch. This is simpler but means:
- Can't do speculative optimizations beyond type guards
- No way to invalidate compiled code when globals change
- No lazy deopt for map transitions or method redefinition

Potential improvement: add deopt metadata (snapshot of VM state at each guard) + ability to resume interpreter mid-bytecode. This is essentially what LuaJIT snapshots already do.

## Key Takeaway
Deoptimization is not just error recovery — it's the *enabling mechanism* for aggressive optimization. The cheaper deopt is, the more aggressively you can speculate. V8's lazy unlinking, Graal's pervasive deopt, and LuaJIT's snapshot system are all variations on making deopt cheap enough to bet on.
