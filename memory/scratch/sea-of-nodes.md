---
uses: 3
created: 2026-03-23
last-used: 2026-03-26
topics: compiler-ir, sea-of-nodes, jit, v8, graal, turbofan, scheduling, maglev
---

# Sea of Nodes IR — Deep Dive

## Core Idea (Click & Paleczny, 1995)
Traditional IRs have two separate structures: a data-flow graph (SSA) and a control-flow graph (basic blocks). Sea-of-nodes **merges both into one graph**. Nodes represent computations. Edges represent both data dependencies AND control dependencies. There are no basic blocks — instructions float freely in a "sea" until scheduling pins them down.

## Key Properties

### Nodes float freely
Most nodes have only data dependencies — they can execute anywhere their inputs are available. Only side-effecting operations (stores, calls, branches) carry control edges that pin them to specific points. This means optimizations like code motion are nearly free — just don't violate data deps.

### Two edge types
- **Data edges**: value produced → value consumed (like SSA use-def)
- **Control edges**: ordering constraints for side effects (stores, calls, I/O)
- **Effect edges** (V8 extension): track memory/effect dependencies separately from control

### No basic blocks (until scheduling)
The compiler works on the floating graph. Only at the very end does a "scheduler" assign nodes to basic blocks and determine execution order. This is the opposite of traditional compilers where blocks are the fundamental unit from the start.

### Phi nodes → special merge nodes
Instead of φ-functions at block boundaries, sea-of-nodes has Phi nodes that merge values at control-flow merge points (Region/Merge nodes).

## The Three Edge Types in Detail (V8 TurboFan)

### Data edges
- Pure data dependencies: `Add(x, y)` depends on `x` and `y`
- SSA-like: each node produces one value, used by zero or more downstream nodes
- These are the "free" edges — no ordering constraint beyond "input before output"

### Control edges
- Form a control-flow graph: Start → If → Branch → Merge → End
- Pin side-effecting operations to specific control points
- **Only operations that affect control flow** need control edges: branches, calls, throws
- Pure operations (arithmetic, comparisons) have NO control edges — they float

### Effect edges (V8's innovation)
This is the crucial V8 extension. JavaScript has pervasive side effects:
- Property access triggers getters/proxies
- String operations can cause conversion
- Array access can trigger prototype lookups

V8 chains effect-producing operations with effect edges:
```
LoadNamedProperty("x", obj) --effect--> StoreNamedProperty("y", obj, val)
```
This prevents reordering of operations that touch the same memory, without constraining unrelated operations. It's finer-grained than control edges.

**Three chains**: data, control, effect. An operation can participate in all three:
- `LoadProperty(object, key)`: data deps (object, key), control dep (must be in reachable block), effect dep (must read after previous write)

## Scheduling: The Final Phase

The scheduler's job: given a floating graph, produce a linear sequence of instructions per basic block.

### Click's scheduling algorithm (simplified):
1. **Compute dominator tree** from control nodes
2. **For each floating node**, find the *latest* legal position (maximally late = minimize register pressure):
   - Legal position = dominated by all inputs, dominates all uses
   - "Latest legal" = in the deepest loop nest possible → wait, that's bad
   - Actually: "earliest legal" = just after all inputs are available (minimizes live ranges in simple cases)
   - V8 uses "late scheduling" with loop-awareness: schedule as late as possible, BUT don't push into loops

### The scheduling dilemma:
- **Early scheduling**: reduces register pressure (value used soon after computed)
- **Late scheduling**: moves code out of hot paths (don't compute what you won't use)
- **Loop-aware scheduling**: never push into a loop; pull out when possible

V8's strategy: schedule at the "latest legal point that isn't in a deeper loop than the inputs". This automatically does LICM!

## LICM Falls Out Naturally

This is the key insight for our JIT: in sea-of-nodes, **LICM is not an optimization pass — it's a scheduling decision**.

In our linear IR, LICM is a complex pass that:
1. Detects loop boundaries
2. Identifies invariant instructions
3. Checks safety (no side effects, dominates all uses)
4. Physically moves instructions before the loop
5. Updates all references

In sea-of-nodes, the instruction was never "in" the loop. The scheduler just places it before the loop because that's the latest legal position that isn't deeper in the loop nest.

## How This Could Improve Our Trace Compiler

### Current limitations of linear IR:
1. Instruction order = execution order → code motion requires physical movement
2. LICM pass must explicitly check invariance → complex, error-prone
3. Dead code elimination needs use-counting
4. Multiple optimization passes have ordering dependencies

### What SoN would give us:
1. Code motion is free (instructions float)
2. LICM is scheduling, not optimization
3. DCE is trivial (unreferenced nodes disappear)
4. Optimization passes are local rewrites → simpler, composable

### What SoN wouldn't help with (trace-specific):
1. Traces are single-path → no merge points → no φ-nodes needed
2. Guard semantics are trace-specific → need special handling
3. Snapshots for deoptimization → need to track state at guard points
4. Side traces → need trace linking, not standard control flow

### Hybrid approach: "Floating linear IR"
Instead of full SoN, we could add dependency edges to our linear IR:
- Mark each instruction with its data dependencies
- During LICM, don't need to "detect" invariance — just check if deps are loop-external
- During scheduling (a new phase), reorder instructions to minimize register pressure

This gets 80% of SoN benefits with 20% of the complexity.

## Comparison: SoN vs Linear IR for Key Optimizations

| Optimization | Linear IR (ours) | Sea-of-Nodes |
|---|---|---|
| CSE | Scan forward, match keys | Graph-local: same-input nodes → merge |
| LICM | Complex pass, move + remap | Falls out of scheduling |
| DCE | Use-counting + mark-sweep | Unreferenced → gone |
| Const fold | Pattern match + replace | Local rewrite rule |
| Scheduling | N/A (order = schedule) | Explicit scheduler needed |
| Complexity | Lower | Higher (graph algorithms) |

## Key Insight

For a **trace compiler**, linear IR is actually a better fit than SoN because:
1. Traces are single-path (no control flow merges)
2. The "schedule" is the execution order (already determined by tracing)
3. The only reordering we do is LICM (which is well-handled by our current pass)
4. Guards create side exits, not control flow joins

SoN shines for **method compilers** (like TurboFan) that must handle arbitrary control flow, multiple paths, and complex optimization of programs they haven't seen execute.

**Conclusion: Our linear IR is the right choice for a trace JIT. The floating dependency idea could improve our LICM pass, but full SoN would add complexity without proportional benefit.**

## What To Steal from SoN

1. **Explicit dependency edges**: Add `deps: [ref, ...]` to IR instructions. Makes LICM trivial.
2. **Effect edges**: Already implicit in our side-effect tracking. Could formalize.
3. **Local rewrite rules**: Our optimizer passes already work this way. Keep it.
4. **Late scheduling heuristic**: After optimization, reorder instructions to minimize register pressure.

## References
- Click & Paleczny (1995). "A Simple Graph-Based Intermediate Representation" — Rice University TR95-252
- V8 blog: "Digging into the TurboFan JIT" (2015)
- Graal: Duboscq et al. "An Intermediate Representation for Speculative Optimizations in a Dynamic Compiler" (2013)
- Ben Titzer's talk: "Behind TurboFan" (BlinkOn 3, 2014)

## V8 Maglev: The Anti-Sea-of-Nodes (Added 2026-03-26)

V8's own team built Maglev (mid-tier JIT, shipped Chrome M117) using a **CFG-based SSA IR** instead of sea-of-nodes, explicitly calling TurboFan's SoN "cache unfriendly."

### Maglev Architecture
- Single forward pass over bytecode → SSA graph with CFG
- Immediate specialization during graph building (no separate lowering phases)
- Known Node Information: propagates type/shape knowledge forward during graph building
- Register allocation via single forward walk with abstract register state
- Code generation directly from nodes (macro assembler)

### Maglev's Design Principles (vs TurboFan)
1. **No sea-of-nodes** → CFG-based, predictable iteration order
2. **Immediate specialization** → no "build generic graph then lower" approach
3. **Minimal passes** → graph building does most work; no explicit optimization pipeline
4. **10x faster compilation than TurboFan** → trades peak performance for compilation speed
5. **Deoptimization shares TurboFan's mechanism** → frame states mapped to SSA values

### Why This Validates Our Approach
Our Monkey JIT is structurally similar to Maglev in key ways:
- Linear IR (not sea-of-nodes)
- Specialization happens during trace recording (not separate lowering)
- Deopt via snapshots (equivalent to Maglev's frame states)
- Fast compilation at the cost of theoretical peak performance

The hierarchy is: **Sparkplug** (no IR, 1:1 bytecode→machine code) → **Maglev** (CFG SSA, mid-tier) → **TurboFan** (sea-of-nodes, peak perf).

For a trace JIT like ours, the Maglev approach makes sense: linear IR, immediate specialization, fast compilation. Sea-of-nodes is only worth it when you need TurboFan-level peak optimization and are willing to pay the compile-time cost.

### Performance Numbers (from V8 blog)
- Maglev compilation: ~10x slower than Sparkplug, ~10x faster than TurboFan
- JetStream: meaningful improvement over Sparkplug alone
- Speedometer: 22% improvement (Sparkplug vs no optimization), significant with Maglev
- Energy: -3.5% JetStream, -10% Speedometer vs without Maglev

### Key Maglev Technique: Retroactive Spilling
If a value needs to be spilled, Maglev retroactively tells it to spill at definition (not at the point it runs out of registers). This guarantees the spill dominates all uses. Simple and effective — we could use this if we ever add register allocation to our JIT's code generation.
