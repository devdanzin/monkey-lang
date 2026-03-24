---
uses: 1
created: 2026-03-23
last-used: 2026-03-23
topics: partial-escape-analysis, graal, truffle, allocation-removal, virtualization, deoptimization
---

# Partial Escape Analysis in GraalVM — Deep Implementation Details

## The Core Idea

Standard escape analysis is binary: an object either escapes or doesn't. If it escapes on *any* path, it must be heap-allocated. **Partial escape analysis (PEA)** delays materialization: an object stays "virtual" (decomposed into scalar fields) until it actually escapes, and materialization happens only on the escaping path.

```
Point p = new Point(x, y);   // virtual — just two scalars
if (rare_condition) {
    list.add(p);              // MATERIALIZATION: allocate on heap, only here
}
return p.x + p.y;            // still scalar — no allocation on common path
```

Standard EA would allocate `p` on heap because it escapes in the `if` branch. PEA allocates only when the `if` branch is actually taken. This is a huge win for dynamic languages where most objects are short-lived but occasionally escape to deopt frame states.

## How It Works (from Stadler et al. 2014 + source)

PEA operates as a **dataflow analysis** over the sea-of-nodes IR graph, walking blocks in dominator order. The abstract state maps each virtual object to either:
- **Virtual state**: object decomposed into field values (scalars or other virtual objects)
- **Materialized state**: a pointer to the heap-allocated object

### The Algorithm (PartialEscapeClosure.java, ~1600 lines)

1. **Forward walk**: Process nodes block by block in scheduled order
2. **For each allocation node** (`VirtualizableAllocation`): Don't emit it. Instead, create a virtual object state with default field values. Track it via `VirtualObjectNode` with a unique `objectId`.
3. **For each use of a virtual object**:
   - If the use is "virtualizable" (field read/write, type check, etc.): operate on the virtual state directly. A field read becomes a lookup in the virtual state; a field write updates the state.
   - If the use **requires materialization** (passed to a call, stored in a non-virtual location, used as monitor): **materialize** — emit the actual `new` + field stores at this point. Insert into the predecessor block's effects.
4. **At merge points** (control flow joins): 
   - If same virtual object is virtual on all predecessors with compatible field states → stays virtual, create phi nodes for differing field values
   - If virtual on some, materialized on others → materialize on all virtual predecessors (insert allocation in those predecessor blocks)
   - If different virtual objects → materialize all (can't merge different identities)
5. **At loop headers**: Special handling — can't keep objects virtual across loop iterations indefinitely. `EscapeAnalysisLoopCutoff` (depth limit) controls when to force materialization. Iterates until stable.
6. **At loop exits**: Create `ValueProxyNode` wrappers to maintain SSA form for values that changed inside the loop.

### The Effects System

PEA doesn't modify the graph during analysis. Instead, it accumulates `GraphEffectList` — a deferred list of graph modifications (add node, delete node, replace input). Effects are applied in a single pass after analysis completes. This is critical for correctness: the analysis must see the original graph, not its own modifications.

### Frame States and Deoptimization

The hardest part of PEA is handling **frame states** (deoptimization points). Every guard/safepoint needs a frame state capturing all live values. If a virtual object is live at a deopt point, the frame state must record its field values as a `VirtualObjectState` — telling the deoptimizer how to reconstruct the heap object if deopt happens.

This is why PEA is so valuable for Truffle: partial evaluation creates many guards, each needing frame states. Without PEA, every object referenced in a frame state would need to be heap-allocated. With PEA, they stay virtual as long as the frame state can describe how to reconstruct them.

### Materialization Counters

The source tracks several materialization categories:
- `MATERIALIZATIONS` — general materialization
- `MATERIALIZATIONS_PHI` — at phi nodes where inputs are mixed virtual/materialized
- `MATERIALIZATIONS_MERGE` — at merge points with incompatible states
- `MATERIALIZATIONS_UNHANDLED` — non-virtualizable uses
- `MATERIALIZATIONS_LOOP_EXIT` — at loop exits with exception handling

### Lock Ordering Complication

PEA can reorder materializations relative to `monitorenter` operations, creating **unstructured locking**. With lightweight locking (thread-local lock stack), this is illegal — the lock stack would become inconsistent. The `requiresStrictLockOrder` flag forces materialization of all virtual locked objects before any new `monitorenter` with lower lock depth.

## Key Insights

1. **Materialization is path-sensitive.** The same object can be virtual on the fast path and materialized on the slow path. This is what makes it "partial" — escape is per-path, not per-object.

2. **The merge operation is the most complex part.** The `merge()` method iterates until stable because materializing one object can cascade — a materialized object's fields may reference other virtual objects that now need materialization too.

3. **Virtual object identity.** When different virtual objects merge at a phi, PEA can sometimes create a "value object" (identity-free) if the original allocations are single-use. This avoids materializing just because different branches created different objects of the same type.

4. **Effects are deferred, not immediate.** This two-phase approach (analyze then apply) is cleaner but means the analysis must be careful about what graph state it reads.

5. **Byte arrays need special handling.** Escaped large writes (long/double into byte[]) create multi-slot entries that must be carefully merged — the code handles default (zero) entries by widening them to match escaped writes from other branches.

6. **Loop depth cutoff prevents exponential blowup.** Beyond `EscapeAnalysisLoopCutoff` depth, PEA stops new virtualizations and may throw `RetryableBailoutException` if forced to materialize `ensureVirtualized` objects.

## Why This Matters for Truffle/Dynamic Languages

In a Truffle interpreter after partial evaluation:
- **Argument arrays** (varargs) → virtual, fields become direct parameter passing
- **Boxing** (int → Integer) → virtual if not escaping, just keep the int
- **Iterator objects** → virtual, loop variable + hasNext state become scalars
- **Frame objects** (Truffle VirtualFrame) → virtual, local variables become SSA values
- **Closures** → virtual if not escaping, captured variables become direct references

This is why GraalPy/TruffleRuby can be competitive with V8 — PEA removes the allocation overhead that makes naive dynamic language implementations slow.

## Comparison with PyPy's Approach

PyPy does allocation removal during tracing (Bolz et al. 2011). Since traces are linear, their escape analysis is simpler — no merge points to reason about. But it's also less powerful: an object that escapes anywhere in the trace is allocated for the whole trace. Graal's PEA can keep it virtual on the non-escaping iterations and only materialize on the escaping one.

## Connection to My Work

My Monkey JIT doesn't have allocation to remove (JS host handles that), but the *concept* of path-sensitive specialization is relevant:
- Guards that fail on rare paths should only pay cost on those paths
- Type specialization can be "virtual" (assumed) until a guard forces "materialization" (fallback to generic code)
- The pattern of deferred effects (analyze then apply) is useful for any multi-pass optimization
