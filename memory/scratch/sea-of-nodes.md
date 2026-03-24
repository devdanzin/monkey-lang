---
uses: 1
created: 2026-03-23
last-used: 2026-03-23
topics: compiler-ir, sea-of-nodes, jit, v8, graal, turbofan
---

# Sea of Nodes IR

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

## Why It Matters for Optimization

**Code motion is trivial.** In a traditional IR, moving an instruction out of a loop requires:
1. Dominator analysis
2. Loop detection  
3. Proving the instruction has no side effects
4. Actually moving it and updating the CFG

In sea-of-nodes, the instruction was never "in" the loop — it just floats. The scheduler naturally places it at the latest legal point (or earliest, depending on heuristic).

**Local rewrite rules are powerful.** Most optimizations become pattern matching on small subgraphs:
- Constant folding: match `Add(Const(3), Const(4))` → replace with `Const(7)`
- Redundancy elimination: match duplicate nodes with same inputs → merge
- Strength reduction: match `Mul(x, Const(2))` → `Add(x, x)`

No need for complex dataflow frameworks — just iterate local rules until fixpoint.

**Dead code elimination is trivial.** Unreachable nodes have no users → just collect them.

## Who Uses It

- **HotSpot C2** (original, Cliff Click): Java's server JIT since ~1999
- **V8 TurboFan**: JavaScript JIT. Extended with explicit "effect chain" edges for memory ordering
- **Graal**: Modern Java JIT (Truffle/GraalVM). Most sophisticated implementation — supports PEA, speculative optimization, deoptimization
- **Cranelift** (Wasmtime): Rust-based. Uses "e-graph" variant (equality saturation)

## V8's TurboFan Extensions

TurboFan adds a third edge type beyond data and control: **effect edges**. These track which operations read/write memory, allowing the scheduler to reason about memory ordering without conflating it with control flow. This is crucial for JavaScript where property accesses have observable side effects.

The pipeline: JavaScript → Bytecode → TurboFan graph → type feedback → lowering → scheduling → register allocation → machine code.

## Comparison with My Tracing JIT

My trace-based IR is fundamentally different:
- **Linear trace**: instructions in execution order, not a graph
- **Implicit control**: guards + side exits, no merge points
- **No scheduling needed**: trace IS the schedule

But some SoN ideas could apply:
- **Effect tracking**: distinguishing pure ops from side-effecting ones (I already do this for LICM)
- **Local rewrite rules**: my optimizer passes (CSE, const prop, etc.) are essentially local pattern matches
- **Floating invariants**: LICM is essentially "letting nodes float" above the loop

**Key insight**: A trace compiler gets many SoN benefits for free because traces are single-path — no merge points, no need for φ-nodes, code motion is just reordering a linear list while respecting deps.

## Downsides of Sea-of-Nodes

1. **Scheduling complexity**: The final scheduling pass is hard to get right. Poor scheduling → poor register pressure → spills
2. **Debugging difficulty**: No obvious "where is this instruction?" — it floats
3. **Compile time**: Graph manipulation can be slower than linear IR passes
4. **Phase ordering**: Some optimizations interact badly when everything floats freely

## Connection to Partial Escape Analysis

Graal's PEA (explored earlier today) works naturally in SoN because virtual objects are just graph nodes that may or may not materialize. The path-sensitivity of PEA maps to control-flow merge points in the graph. When an object escapes on one path, materialization is inserted only on that path's control edge.

## References
- Click & Paleczny (1995). "A Simple Graph-Based Intermediate Representation" — Rice University TR95-252
- V8 blog: "Digging into the TurboFan JIT" (2015)
- Graal: Duboscq et al. "An Intermediate Representation for Speculative Optimizations in a Dynamic Compiler" (2013)
