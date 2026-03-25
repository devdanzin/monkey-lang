---
uses: 1
created: 2026-03-24
last-used: 2026-03-24
topics: allocation-sinking, luajit, graal, pea, jit, optimization
---

# Allocation Sinking: LuaJIT vs Graal PEA — Deep Implementation Analysis

## What Allocation Sinking Does

Removes heap allocations from hot paths by keeping objects "virtual" (decomposed into scalar fields) until they actually escape. If an object is created, used, and discarded within a trace/loop without escaping, the allocation is eliminated entirely.

## LuaJIT's Approach (~200 lines in lj_opt_sink.c)

### Architecture: Mark-and-Sweep on IR

LuaJIT's sinking is beautifully simple — a two-phase backward pass:

**Phase 1: Mark non-sinkable allocations**
- Walk IR backward from end
- **Roots**: guards, remaining loads (not eliminated by S2LF), non-constant keys, all stored values
- Any allocation reachable from a root is marked non-sinkable
- Propagation: if an instruction is marked AND it references an allocation → mark that allocation

**Phase 2: Sweep and tag sinkable ones**
- Walk IR again, tag unmarked allocations with `RID_SINK`
- Tag associated stores with `RID_SINK` too (they become "virtual stores")
- Set `J->cur.sinktags = 1` to signal the assembler that sunk allocations exist

### What's Eligible
Only three IR ops: `IR_TNEW` (new table), `IR_TDUP` (table from template), `IR_CNEW`/`IR_CNEWI` (FFI cdata). Tables are the big win — Lua creates tons of short-lived tables.

### The PHI Complication
For looping traces, an allocation on one loop iteration might be the same "virtual" object as the next iteration's. LuaJIT handles this with `sink_remark_phi`:
- If a PHI pairs two allocations (left = iter N, right = iter N+1), they can both sink
- But if their marks or PHI value counts differ → remark both as non-sinkable
- Iterates until stable (classic dataflow fixpoint)

`sink_checkphi` verifies stored values are either:
1. PHI nodes themselves (loop-varying but trackable), or
2. Loop-invariant (defined before `J->loopref`)
3. Not dependent on PHIs (checked via bounded DFS, `sink_phidep` with work limit of 64)

### Restoration at Deopt (`snap_unsink`)
When a guard exits and the snapshot references a sunk allocation:
1. **Actually allocate** the object (table or cdata) at exit time
2. Walk IR from alloc+1 to snapshot ref, find stores tagged with `RID_SINK`
3. For each sunk store: restore the stored value from registers/spill slots, write to the newly allocated object
4. The snapshot entry now points to the real heap object

Key detail: `snap_sunk_store()` checks that a store corresponds to a specific allocation (follows the reference chain ASTORE→AREF→alloc). Fast path is a delta check, slow path walks the chain.

### Why It's Only ~200 Lines
- Linear trace IR means no merge points (unlike Graal's sea-of-nodes)
- Only tables and cdata — no arbitrary objects
- Two-phase mark-sweep is simple and correct
- Restoration is straightforward: just replay the stores

## Graal's PEA (Partial Escape Analysis) — The Full Generalization

### Key Difference: Path-Sensitivity
LuaJIT: object either sinks or doesn't (whole trace)
Graal: object can be virtual on some paths, materialized on others

```
Point p = new Point(x, y);
if (rare) { list.add(p); }  // materialize ONLY HERE
return p.x + p.y;           // still virtual on common path
```

### Key Difference: Merge Points
LuaJIT traces are linear — no merges. Graal operates on a graph with control flow:
- At join points: if same virtual object is virtual on all predecessors → stays virtual (PHI for fields)
- If virtual on some, materialized on others → materialize on the virtual paths
- If different allocations merge → materialize all

This is ~1600 lines in `PartialEscapeClosure.java` vs LuaJIT's ~200.

### Key Difference: Frame States
Every deopt point in Graal needs a frame state. Virtual objects in frame states become `VirtualObjectState` — telling the deoptimizer how to reconstruct. This is what enables PEA to work: the object doesn't need to exist as long as the runtime knows how to recreate it.

### Deferred Effects
Graal PEA doesn't modify the graph during analysis — accumulates `GraphEffectList` and applies in one pass after. Similar philosophy to LuaJIT's mark-then-sweep.

## Applicability to Monkey JIT

### Current State
My JIT already has:
- Escape analysis for arrays (BUILTIN_PUSH → in-place mutation when old array doesn't escape, 11x on array:build)
- BOX_INT / UNBOX_INT / BOX_STRING / UNBOX_STRING (variable promotion keeps raw values in loops)
- Deoptimization snapshots (implemented today in Session B)

### What Allocation Sinking Would Add

**The core question**: What allocates in Monkey JIT traces?

1. **MonkeyInteger/MonkeyBoolean/MonkeyString wrapping** — already handled by variable promotion (UNBOX/BOX). This IS allocation sinking, just specialized.

2. **MonkeyArray creation** — `BUILTIN_PUSH` creates new arrays. Already has escape analysis for the special case of push-then-use. General sinking would handle: create array, store elements, pass to function → if function is inlined, array might not escape.

3. **MonkeyHash creation** — similar to array but via hash literal syntax. Less common in hot loops.

4. **String concatenation** — each CONCAT creates a new MonkeyString. Could sink if result is immediately unboxed or only used in one comparison.

### The JS Target Complication
Since we compile to JS (not machine code), "sinking" means something different:
- We can't control V8's allocation decisions
- But we CAN avoid creating MonkeyObject wrappers
- Variable promotion already does this for integers and strings
- General sinking would extend this to arrays and hashes: keep as raw JS arrays/objects in the trace, only wrap at exit

### Practical Implementation Sketch
```
// Before sinking:
let v3 = [];                          // MonkeyArray equivalent
v3.push(new MonkeyInteger(v1));       // wrap + store
v3.push(new MonkeyInteger(v2));       // wrap + store
let v6 = v3.length;                   // use
// v3 never escapes trace

// After sinking:
let v6 = 2;  // constant-folded from known array length
// Array and both MonkeyInteger allocations eliminated
```

### Estimated Complexity
- For the Monkey JIT: ~100-150 lines (simpler than LuaJIT because linear traces + JS target)
- Mark phase: walk IR backward, find allocations whose results are only used by stores + length checks + index operations (all virtualizable)
- Eliminate phase: replace reads with direct value references, delete allocation + stores
- Exit handling: already have snapshots — extend to include "virtual objects" that need materialization

### Priority Assessment
**Low priority for now.** Variable promotion already captures the biggest win (unboxing integers/strings in loops). The remaining allocation sites (array/hash creation in hot loops) are less common in typical Monkey programs. Would become higher priority if:
- Monkey gets more complex data structures (classes, records)
- Benchmarks show allocation as a bottleneck (currently V8 handles this well)
- We want to demonstrate the technique for educational/blog purposes

## Key Insight
LuaJIT's allocation sinking is the trace-JIT-specific version of Graal's PEA. Both solve the same problem (delay materialization), but LuaJIT's linear traces make the analysis trivially simpler. The ~200 lines vs ~1600 lines ratio is almost entirely due to merge point handling. For a trace JIT like Monkey's, the LuaJIT approach is the right model.

## Connection to Deopt
Sinking and deoptimization are deeply coupled: you can only sink if you can unsink. The more complete your deopt infrastructure, the more aggressively you can sink. Today's deopt snapshot work directly enables future sinking.
