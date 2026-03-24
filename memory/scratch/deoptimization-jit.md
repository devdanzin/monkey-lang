---
uses: 3
created: 2026-03-22
last-used: 2026-03-24
topics: deoptimization, jit, v8, graal, truffle, luajit, snapshots, on-stack-replacement, guards
---

# Deoptimization in Production JITs

The inverse of JIT compilation: jumping from optimized code back to interpreted/unoptimized code, restoring full interpreter state. **This is the enabling mechanism for aggressive speculative optimization.**

## Core Principle
The cheaper deopt is, the more aggressively you can speculate. Every deopt system solves the same problem: how to reconstruct interpreter-visible state from optimized (register-allocated, reordered, partially-evaluated) machine state.

## LuaJIT Snapshots (Most Relevant to Monkey JIT)

### Architecture
LuaJIT takes **snapshots** of the interpreter state at each guard point during trace recording. A snapshot maps Lua stack slots → IR references (which resolve to registers/spill slots at runtime).

### Key Data Structures
- **SnapShot**: metadata (nent, nslots, mapofs into snapmap, ref to IR position, mcofs for machine code offset)
- **SnapEntry**: packed `slot | flags | IRref` — maps one stack slot to one IR value
- **snapmap[]**: flat array of SnapEntries, shared across all snapshots (offset-indexed)
- **Frame links**: appended after slot entries, encode the Lua call stack for multi-frame restoration

### Snapshot Lifecycle
1. **`lj_snap_add()`** — called after each guard IR instruction. Takes `snapshot_stack()` which iterates all slots, skipping unmodified ones (optimization: if slot is just an SLOAD of itself with no intervening store, skip it — `SNAP_NORESTORE`).
2. **Merging** — if no IR emitted since last snapshot, or if explicitly requested and no guard emitted, the new snapshot *replaces* the previous one (saves space).
3. **`lj_snap_purge()`** — uses bytecode dataflow analysis (`snap_usedef()`) to identify dead slots *before* taking the snapshot. Zeros them out so they don't waste snapshot space.
4. **`lj_snap_shrink()`** — post-hoc removal of entries for slots that are dead after the snapshot point.
5. **`lj_snap_restore()`** — THE key function. On guard failure (trace exit):
   - Reads the exit state (registers + spill slots from `ExitState`)
   - Walks the snapshot entries, restoring each slot from its IR ref's register/spill location
   - Uses a **Bloom filter** (`snap_renamefilter`) for register renames (rare but handles cases where register allocator moved values after snapshot)
   - Handles **sunk allocations** — objects that were scalar-replaced (via allocation sinking/PEA) get materialized back to heap objects at deopt time
   - Reconstructs frame links for multi-frame call stacks
   - Sets L->base and L->top correctly
   - Returns the PC to resume interpretation at

### Key Optimization: Dead Slot Elimination
`snap_usedef()` does a mini dataflow analysis on the *bytecode* (not IR) to find which slots are live at each snapshot point. This is critical — without it, snapshots would be huge (every slot in every frame). The analysis walks forward from the snapshot PC, tracking USE/DEF per slot.

### Key Optimization: Sunk Allocation Restoration
When allocation sinking removes a heap allocation (table, closure), the values that *would* have been in that object are kept in registers/stack. At deopt, `snap_unsink()` reconstructs the object from those scattered values. This is the same concept as Graal's PEA materialization.

## V8 TurboFan Deoptimization

### FrameStates
TurboFan's equivalent of LuaJIT snapshots. Nodes in the IR graph that capture the full interpreter state (bytecode offset, locals, accumulator, context, parameters) at each potential deopt point.

### Deopt Kinds
- **Eager**: Guard fails immediately → deopt now (type check, overflow, bounds)
- **Lazy**: Code *marked* for deopt but continues until next entry point
  - Since 2017: lazy unlinking via `marked_for_deoptimization` bit in code prologue
  - Triggers on: map deprecation, prototype change, property cell change
  - Saves ~170KB on facebook.com (eliminated per-JSFunction linked list overhead)

### Deopt Reasons (from source — 70+ reasons!)
Key categories:
- **Type mismatches**: NotASmi, NotAHeapNumber, NotAString, NotAJavaScriptObject, WrongMap, WrongInstanceType
- **Numeric edge cases**: Overflow, MinusZero, NaN, LostPrecision, DivisionByZero
- **Insufficient feedback**: InsufficientTypeFeedbackFor{BinaryOperation,Call,Compare,...} — not enough profiling data to speculate
- **Structural changes**: ArrayLengthChanged, CowArrayElementsChanged, DeprecatedMap, PropertyCellChange
- **OSR**: PrepareForOnStackReplacement, OSREarlyExit

### Deopt Metadata Size
FrameStates are one of the biggest sources of IR bloat in method JITs. Every potential deopt point needs a full state snapshot. LuaJIT's approach is more compact because traces are linear — fewer deopt points per unit of compiled code.

## Graal/Truffle: Deopt as Core Abstraction

Truffle's key innovation: deoptimization IS the programming model. Instead of runtime checks:
- `transferToInterpreterAndInvalidate()` — deoptimize + invalidate compilation
- Guards in Truffle nodes → on failure, deopt to interpreter, re-specialize AST node, recompile
- PEA + deopt = objects exist in registers until they escape; deopt materializes them

This means Truffle interpreters write zero guard code — they write specialization nodes with `@Specialization` annotations, and the framework generates guards + deopt automatically.

## Implications for Monkey JIT

### Current State
- Guards abort the trace → fall back to VM dispatch at the loop header
- No snapshot of intermediate state — can only resume at trace entry point
- No lazy invalidation — compiled traces stay valid even if globals change

### What Snapshots Would Enable
1. **Mid-trace exit**: Guard at instruction N can resume interpreter at bytecode N, not loop top. Means less repeated work on deopt.
2. **More aggressive speculation**: Could speculate on hash shapes, string types, closure identity — anything with a cheap deopt fallback.
3. **Global invalidation**: When a global is reassigned, mark all traces reading it for deopt. Currently impossible — traces using globals can go stale silently.
4. **Allocation sinking**: Already have escape analysis (11x on array:build). With snapshots, could sink more allocations and rematerialize on deopt.

### Implementation Sketch for Monkey
Since Monkey JIT compiles to JavaScript (not machine code), "snapshots" would be:
1. At each guard in IR, record: `{pc: bytecodeOffset, locals: {slot→IRRef}, stack: [IRRef...]}`
2. In codegen, each guard exit returns the snapshot data: `return {exitType: 'guard', snap: {pc: 42, locals: {0: v3, 1: v7}}}`
3. VM receives the snapshot, writes values back to the frame's locals/stack arrays, sets IP to snap.pc, resumes dispatch loop

This is much simpler than LuaJIT's register-level restoration because JS handles all the register allocation. The snapshot is just a map of local slots to JS variable names in the compiled function.

### Cost Analysis
- **Space**: One snapshot per guard. With ~5-10 guards per trace and ~5 locals, that's ~50-100 entries. Trivial in JS.
- **Time**: Guard exit path adds one object literal construction. Negligible vs the interpreter dispatch it replaces.
- **Complexity**: Moderate — need to thread snapshot data through IR → optimizer → codegen. Optimizer must update snapshots when it eliminates/moves instructions.

**The optimizer interaction is the hard part.** When CSE replaces a reference, or DCE removes a store, or LICM moves a load, the snapshot must still point to live values. LuaJIT solves this with IR_RENAME instructions that track register movements. In JS-targeted codegen, we'd need to ensure all snapshot-referenced variables are still in scope at the guard point.
