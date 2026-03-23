---
uses: 2
created: 2026-03-21
last-used: 2026-03-22
topics: graalvm, truffle, partial-evaluation, jit, polyglot, futamura, sea-of-nodes
---
# GraalVM/Truffle: Partial Evaluation JIT

The third major JIT paradigm alongside tracing (LuaJIT/PyPy) and copy-and-patch (CPython 3.13+). GraalVM's Truffle framework uses **partial evaluation** of AST interpreters to produce optimized machine code.

## The Core Idea

Like PyPy's meta-tracing, Truffle's goal is: **write an interpreter, get a compiler for free.** But where PyPy traces execution (recording what happens at runtime), Truffle does **partial evaluation** (symbolically executing the interpreter with a known program, constant-folding away the interpretation overhead).

The distinction is fundamental:
- **Tracing (PyPy)**: run the interpreter, record what it does → linear trace
- **Partial evaluation (Truffle)**: symbolically inline the interpreter with a fixed AST → method graph

Tracing produces a linear trace of one execution path. Partial evaluation produces a graph of all reachable paths from a given AST node tree — more like a traditional method JIT output.

## How It Works

### Step 1: Write an AST Interpreter in Java

Language implementers write a standard tree-walking interpreter using Truffle's node API:

```java
@NodeChild("left") @NodeChild("right")
abstract class AddNode extends ExprNode {
    @Specialization(guards = "isInt(left, right)")
    int doInt(int left, int right) { return left + right; }
    
    @Specialization
    double doDouble(double left, double right) { return left + right; }
    
    @Fallback
    Object doGeneric(Object left, Object right) { /* slow path */ }
}
```

The `@Specialization` annotations define type-specialized variants. At runtime, each AST node **self-specializes**: it starts with the most specific specialization that matches, and broadens (respecializes) if new types appear. This is **inline caching at every AST node**.

### Step 2: Self-Specializing AST Execution

On first execution, the AST is unspecialized. As values flow through, each node rewrites itself to match observed types:

```
AddNode(generic) → AddNode(int,int) → [if double seen] → AddNode(double,double)
```

After warmup, the AST has stabilized: each node knows what types it typically sees. The tree shape itself encodes profiling information.

### Step 3: Partial Evaluation (The Magic)

When a function is hot enough, Truffle invokes the Graal compiler's partial evaluator:

1. **Start from the root execute() method** of the AST
2. **Inline everything**: recursively inline all `execute()` calls on child nodes. Since the AST shape is known (it's a constant tree), the compiler can resolve all virtual dispatches.
3. **Constant-fold the tree structure**: the AST node objects, their fields, and the dispatch logic are all constants during PE. They fold away, leaving only the actual computation.
4. **What remains**: a Graal IR graph that does exactly what the program does — no interpreter overhead, no virtual dispatch, no tree walking.

This is the **first Futamura projection** applied at runtime: specializing an interpreter with respect to a specific program to produce the compiled program.

### Step 4: Graal Compiler Optimization

The resulting IR graph goes through Graal's full optimization pipeline:
- **Sea-of-nodes IR**: data-flow + control-flow in one graph (like V8's TurboFan, inspired by Click's 1995 thesis)
- Speculative optimizations based on the profiling data embedded in the specialized AST
- Global value numbering, escape analysis, loop optimizations, inlining
- **Deoptimization**: if a speculation fails (new type appears), compiled code transfers back to the interpreter via deoptimization points

### Step 5: Code Generation

Graal compiles the optimized IR to machine code. The compiled code runs until a deoptimization triggers, at which point:
1. The interpreter resumes from the deopt point
2. The AST node respecializes for the new type
3. Eventually, the function gets recompiled with the updated specializations

## Key Design Decisions

### AST, Not Bytecode

Unlike almost every other high-performance VM, Truffle compiles from **AST** not bytecode. Why?

1. **Partial evaluation needs structure.** An AST's tree shape tells the compiler exactly which operations happen in what order. Bytecode requires reconstruction of this structure (which is what "building the IR" does in traditional JITs).
2. **Self-specialization is natural on trees.** Each node independently specializes based on its inputs. In bytecode, you'd need side tables of type profiles.
3. **Cross-language composition.** Truffle's polyglot interop works at the AST level — a JavaScript AST node can call a Ruby AST node directly, and partial evaluation inlines across the language boundary.

**Trade-off**: AST interpretation is slower than bytecode interpretation (deeper call stacks, more virtual dispatch). Truffle compensates by compiling aggressively — the interpreter is just a warmup phase.

**Update (Truffle 22.1+)**: Truffle now supports an optional **bytecode DSL** that generates a bytecode interpreter from the same node definitions. This gives fast interpreter-mode execution while still enabling PE-based compilation. Best of both worlds.

### The Compilation Boundary (`@TruffleBoundary`)

Not everything should be inlined during partial evaluation. `@TruffleBoundary` marks methods that the PE should not inline (they'll be regular calls in compiled code). This controls compilation unit size — without boundaries, PE would inline the entire runtime library.

### Assumptions and Deoptimization

Truffle's `Assumption` API lets compiled code depend on runtime invariants:
- "This class has not been modified" (for cached method lookups)
- "This global variable has not been reassigned"
- "This object's shape has not changed"

When an assumption is invalidated, all compiled code depending on it is immediately deoptimized. This is **global deoptimization** — more aggressive than LuaJIT's per-trace guards.

### Object Shapes (Hidden Classes)

Truffle's `DynamicObject` uses a **shape** system (equivalent to V8's hidden classes / maps):
- Each unique object layout gets a Shape
- Shapes form a transition tree (add property → new shape)
- Compiled code guards on shape identity (single pointer comparison)
- Shape transitions are profiled and specialized

## Comparison with Other Approaches

### vs. PyPy Meta-Tracing

| Dimension | PyPy | Truffle/Graal |
|-----------|------|---------------|
| Technique | Tracing | Partial evaluation |
| Output | Linear traces | Method-level IR graphs |
| Branching | Guard + side trace | Full control flow in graph |
| Polymorphism | Guard failures → trace exits | Speculative specialization + deopt |
| Cross-function | Automatically inlined into trace | Inlined during PE |
| Warmup | Moderate (trace + compile) | Slower (AST interp + PE + Graal compile) |
| Peak performance | Excellent on loop-heavy code | Excellent on complex code |
| Implementation language | RPython | Java |

Key difference: **tracing struggles with polymorphic code** (many guard failures → many side traces → trace explosion). **Partial evaluation handles it naturally** because the full control flow is in the graph. But tracing has an advantage on tight loops — the trace is perfectly linear, trivially optimizable.

### vs. Copy-and-Patch (CPython)

Copy-and-patch is at the other end of the complexity spectrum:
- **Truffle/Graal**: ~500K lines of Java, full optimizing compiler, cross-language composition
- **Copy-and-patch**: ~4K lines, memcpy + patch, modest but real speedups

Copy-and-patch optimizes nothing across operation boundaries. Truffle's PE + Graal optimizes globally. The results reflect this: GraalPy is 3-4x faster than CPython on many benchmarks, while CPython's JIT adds 5-9%.

### vs. Method JIT (V8 TurboFan, HotSpot C2)

Truffle/Graal IS a method JIT at the compiler level — Graal is a method-based optimizing compiler. The innovation is in the **frontend**: instead of hand-writing a language-specific compiler frontend for each language, Truffle uses PE of the interpreter as a universal frontend. This means:
- **V8**: hand-written JavaScript-specific frontend → TurboFan
- **Truffle**: AST interpreter + PE → Graal (same quality, less language-specific engineering)

## The Sea-of-Nodes IR

Graal uses the sea-of-nodes representation (Click & Paleczny 1995):

- **Fixed nodes** (control flow): begin, end, if, merge, loop begin/end, deopt
- **Floating nodes** (values): arithmetic, loads, constants — these "float" without fixed position
- **Scheduling** happens late: the compiler decides where to place floating nodes only during code generation

Why this matters:
1. **Global code motion is free.** Floating nodes naturally move to the optimal position — no need for explicit LICM/GVN passes.
2. **Deoptimization is cheap.** Deopt points capture the interpreter state as a "frame state" node — floating node references describe values without materializing them.
3. **Speculative optimizations are natural.** Speculate → guard → deopt if wrong. The guard is just another control-flow node; the deopt path is a fixed node with a frame state.

Sea-of-nodes is also used by V8's TurboFan and (historically) HotSpot's C2 compiler. It's the gold standard for speculative JIT compilation.

## Polyglot: The Unique Advantage

No other JIT framework enables cross-language optimization:

```javascript
// JavaScript calling Ruby
const rubyArray = Polyglot.eval('ruby', '[1, 2, 3]');
const sum = rubyArray.reduce((a, b) => a + b, 0);
```

During PE, the JavaScript `reduce` and the Ruby array access are inlined into the same compilation unit. Graal optimizes across the language boundary — removing boxing, virtualizing dispatch, inlining the entire operation. This is unique to Truffle.

## Performance Characteristics

- **Warmup**: Slowest of the three paradigms. AST interpretation is 2-5x slower than bytecode interpretation. Compilation takes 10-100ms (Graal is a full optimizing compiler). Multi-tier compilation (interpreter → first tier → Graal) helps.
- **Peak throughput**: Competitive with V8, often exceeding it. GraalJS benchmarks match or beat V8 on long-running code. TruffleRuby is 10-30x faster than CRuby on compute-heavy benchmarks.
- **Memory**: Higher baseline (JVM + Graal compiler in memory). Native Image (AOT) mitigates this for deployment but loses some JIT capability.

## Architectural Insights

1. **Partial evaluation is more general than tracing.** It produces full method graphs (all paths) vs. linear traces (one path). This handles polymorphic, branchy code better. But it's more complex to implement and slower to compile.

2. **The interpreter IS the specification.** Like PyPy, you write a straightforward interpreter and get compilation. Unlike PyPy, the mechanism is PE not tracing, so you get method-level compilation not trace-level.

3. **Self-specializing ASTs are inline caches everywhere.** Each node is its own polymorphic inline cache. The AST tree is both the program representation and the profiling data store.

4. **Sea-of-nodes enables speculation.** The floating-node IR makes it cheap to insert speculations (guards + deopts) and lets the compiler freely move code around them.

5. **Compilation is expensive but amortized.** Graal takes 10-100ms per compilation vs. microseconds for LuaJIT or nanoseconds for copy-and-patch. But you only compile hot methods, and the result is higher quality code. The right trade-off depends on workload lifetime.

6. **The Futamura projections are practical, not just theoretical.** PyPy implements the second projection (specialize specializer on interpreter → compiler). Truffle implements the first (specialize interpreter on program → compiled program). Both work in production at scale.

## What This Means for Monkey

Directly applicable ideas:
1. **Self-specializing nodes**: even without PE, we could add type feedback to our bytecode dispatch — track what types each instruction sees and branch to specialized handlers. We already do this with OpAddInt etc.
2. **Assumptions for deoptimization**: if we tracked "this variable is always an integer" as an assumption, we could skip type checks until the assumption breaks.
3. **The PE concept**: our peephole optimizer is a crude form of PE — we see the program at compile time and specialize (constant folding, known-type ops). A more systematic approach would be to symbolically execute the bytecode during compilation.

## Deep Dive: The Partial Evaluation Algorithm

### What PE Actually Does (Mechanically)

PE in Truffle/Graal is implemented as **aggressive inlining + constant folding** on the Graal IR. It's not a separate abstract interpretation — it reuses Graal's existing compiler infrastructure. The steps:

1. **Root method graph construction.** Parse the `CallTarget.callDirect()` → `RootNode.execute(VirtualFrame)` bytecodes into Graal IR (sea-of-nodes graph).

2. **Inlining phase.** For every method call in the graph:
   - If the receiver is a **compilation constant** (known at compile time) and the method is monomorphic → inline it.
   - AST node `execute()` methods are always inlined because the AST nodes are compilation constants (the tree was built before compilation started).
   - This cascades: inlining `BinaryAddNode.execute()` reveals the specialization dispatch, which is a switch on a constant field → the branch folds → only the active specialization remains → its body gets inlined → repeat.
   - **Inlining budget**: Truffle has an `InliningBudget` that limits graph size. When exceeded, remaining calls become regular (non-inlined) calls in the compiled code. `@TruffleBoundary` forces this.

3. **Constant folding cascade.** After each round of inlining:
   - Nodes with all-constant inputs are evaluated and replaced with constants
   - Branches on constants are eliminated (dead path removal)
   - Loads from constant objects with known field values fold to constants
   - This is what eliminates the interpreter: `node.getClass()` is constant → virtual dispatch resolves → specialization field is constant → type check folds → only the fast path remains

4. **Truffle-specific canonicalization.** Truffle registers custom `CanonicalizerPhase` rules:
   - `CompilationFinal` fields are treated as constants after first read
   - `@ExplodeLoop` unrolls loops over compilation-final arrays (like the children array of a node)
   - Frame slot accesses through `VirtualFrame` are escape-analyzed away — the frame becomes local variables

5. **Guard insertion.** Where PE assumed something was constant but it *could* change:
   - Type specializations → guard on the specialization state (deopt if node respecializes)
   - Stable assumptions → guard on assumption validity
   - Shape guards on dynamic objects → guard on shape identity

### The "Compilation Constant" Concept

This is the central abstraction. A value is a **compilation constant** if Graal can prove its value is fixed for the lifetime of the compiled code. Sources of compilation constants:

- **AST nodes themselves**: the tree is built before compilation, nodes don't move
- **`@CompilationFinal` fields**: developer promises the field won't change (or if it does, they'll invalidate)
- **`Assumption`-guarded values**: constant as long as the assumption holds
- **Inlined constants from constant folding**: 2 + 3 → 5

The PE algorithm is essentially: "inline everything reachable from compilation constants, fold everything that becomes constant, repeat until fixpoint."

### Why This Is the First Futamura Projection

The three Futamura projections (Futamura 1971/1983):

**First projection: `specialize(interpreter, program) → compiled_program`**
- Input: an interpreter `I` and a specific program `P`
- Output: a specialized version of `I` that only handles `P` — i.e., a compiled version of `P`
- **Truffle does exactly this.** The interpreter is the AST execute() methods. The program is the specific AST tree. PE specializes the interpreter w.r.t. that tree, producing compiled code for that specific program.

**Second projection: `specialize(specializer, interpreter) → compiler`**
- Input: a partial evaluator `S` and an interpreter `I`
- Output: a specialized version of `S` that, given any program `P`, produces compiled code — i.e., a compiler for `I`'s language
- **PyPy implements this** (approximately). The RPython toolchain takes an interpreter and produces a compiled binary that includes a JIT compiler for that language. The JIT is "pre-specialized" for the specific interpreter.
- **Truffle does NOT do this** — Graal PE runs fresh each time, not pre-specialized for a particular language. But Native Image + PGO gets partway there.

**Third projection: `specialize(specializer, specializer) → compiler_generator`**
- Input: a partial evaluator specialized on itself
- Output: a tool that takes any interpreter and produces a compiler
- **Neither PyPy nor Truffle implements this.** It remains theoretical.

### Practical difference: Truffle's first projection vs. PyPy's second

PyPy: the RPython translation process happens **ahead of time** (once, at build time). The result is a binary with a baked-in JIT for that specific language. You ship the binary. Compilation at runtime is fast because the specializer itself was specialized.

Truffle: PE happens **at runtime** (every time a method gets hot). Graal is a general-purpose compiler, not specialized for any particular language. This means:
- **Slower compilation** (Graal does more work per compilation)
- **More flexible** (any Truffle language works, no build step)
- **Better optimization** (Graal's full optimization pipeline, not a pre-baked trace compiler)

## Deep Dive: Sea-of-Nodes IR Internals

### The Graph Structure

Every node in the Graal IR has:
- **Inputs** (data dependencies): edges pointing to nodes that produce values this node consumes
- **Successors** (control flow): edges pointing to the next node(s) in control flow (only for fixed nodes)
- **Usages** (reverse edges): automatically maintained — who uses this node's output

Two kinds of nodes:

**Fixed nodes** (have a place in the schedule):
- `StartNode`, `EndNode`, `ReturnNode`
- `IfNode` (has two successors: true branch, false branch)
- `MergeNode` (joins multiple control flow paths)
- `LoopBeginNode`, `LoopEndNode`
- `DeoptimizeNode` (transfer to interpreter)
- `InvokeNode` (method calls — fixed because they have side effects)
- Fixed nodes form a **control flow graph** (CFG) through their successor edges

**Floating nodes** (no fixed position — the scheduler decides where to put them):
- `ConstantNode`, `ParameterNode`
- `AddNode`, `MulNode`, `ShiftNode` (pure arithmetic)
- `LoadFieldNode` (reads — can float if no conflicting writes)
- `PhiNode` (at merge points and loop headers)
- `PiNode` (type narrowing after a guard — "I know this is an Integer after the type check")
- `FrameState` (captures interpreter state for deoptimization)

### Why Floating Nodes Are Powerful

Consider this code:
```java
for (int i = 0; i < n; i++) {
    result += array.length * factor;
}
```

In a traditional CFG-based IR, you'd need an explicit LICM pass to hoist `array.length * factor` out of the loop. In sea-of-nodes:

- `LoadFieldNode(array, "length")` floats — its only dependency is `array` (defined outside loop)
- `MulNode(length, factor)` floats — its only dependencies are `length` and `factor` (both outside loop)
- The **scheduler** places both before the loop automatically, because their dependencies allow it

No LICM pass needed. The IR representation *implies* optimal placement.

### Global Value Numbering (GVN)

Because nodes are identified by their operation + inputs (structurally), two nodes with the same operation and same inputs are **the same node**. Graal's `CanonicalizerPhase` implements this:

- When creating `AddNode(x, y)`, check if one already exists → reuse it
- This is automatic CSE/GVN without a separate pass
- Works globally (not just within a basic block) because floating nodes aren't tied to blocks

### FrameState and Deoptimization

Every point where deoptimization might occur has a `FrameState` node that captures:
- The bytecode index (bci) in the original method
- Values of all local variables and stack slots at that point
- Outer frame states (for inlined methods — the "virtual call stack")

Frame states reference floating value nodes. This is key: the values aren't materialized until deopt actually happens. During normal execution, the compiled code doesn't maintain interpreter frames at all — it just uses registers and stack slots as Graal allocated them. Only on deopt does it reconstruct the interpreter state from the frame state metadata.

This is why speculative optimization is cheap: adding a guard + deopt point doesn't require maintaining interpreter state along the fast path. The frame state is just metadata about which values *would* be in which slots *if* we needed to reconstruct the interpreter state.

### Scheduling: From Sea to Sequence

Before code generation, floating nodes must be pinned to specific basic blocks. Graal's scheduler:

1. **Compute the earliest possible placement** for each floating node (limited by data dependencies)
2. **Compute the latest possible placement** (limited by usages — must be before all users)
3. **Choose the best placement** between earliest and latest, preferring:
   - Outside loops (reduce dynamic execution count)
   - In the same block as usage (reduce register pressure)
   - After guards (don't compute values that might be thrown away)

This is the "schedule late" principle. The slack between earliest and latest is the freedom sea-of-nodes provides.

## The Full JIT Pipeline (Truffle → Machine Code)

Putting it all together, when a Truffle `CallTarget` gets hot:

```
1. AST interpreter runs, nodes self-specialize
2. Hot threshold reached → trigger compilation
3. Truffle PE phase:
   a. Parse root execute() to Graal IR
   b. Inline all compilation-constant dispatches
   c. Constant fold, canonicalize, dead code eliminate
   d. Insert guards for speculative assumptions
   e. Result: method-level sea-of-nodes graph
4. Graal high-tier optimizations:
   a. Inlining of remaining (non-PE) calls
   b. Canonicalization + GVN
   c. Escape analysis (virtualize allocations)
   d. Conditional elimination (redundant guards/checks)
   e. Loop optimizations (unrolling, peeling)
5. Graal mid-tier:
   a. Floating → fixed: schedule nodes
   b. Guard lowering (convert to explicit branches + deopt calls)
   c. Frame state assignment
6. Graal low-tier:
   a. Register allocation (linear scan)
   b. Machine code emission (platform-specific backend)
   c. Metadata: deopt info, GC maps, exception handlers
7. Install compiled code, patch call sites
```

Total compilation time: 10-100ms for a typical method. This is why Truffle uses multi-tier: interpreter → first-tier (quick compile, modest optimization) → top-tier (Graal, full optimization). Only truly hot code gets the full treatment.

## Truffle Bytecode DSL (Post-22.1)

The original "AST-only" approach had a warmup problem: tree interpretation is 2-5x slower than bytecode interpretation due to virtual dispatch overhead. The Bytecode DSL fixes this:

- Language developers write the same `@Specialization`-annotated node classes
- The DSL **generates** a bytecode interpreter from these definitions
- The generated interpreter uses a compact bytecode encoding + quickening (type-specialized bytecode rewrites)
- PE still works: the bytecode interpreter is just Java code that Graal can partially evaluate
- The generated code includes **boxing elimination**: specialized execute methods (`executeInt`, `executeDouble`) avoid boxing on the common path

This gives Truffle languages the best of both worlds:
- Fast interpreter mode (bytecode, not AST walking)  
- Same compilation quality (PE still applies)
- Same language definition (no separate AST and bytecode specifications)

TruffleJS (GraalJS), TruffleRuby, and GraalPy all use the Bytecode DSL in recent versions.

## Key Papers & Resources
- Würthinger et al. 2012: "Self-Optimizing AST Interpreters" (DLS '12) — original Truffle paper
- Würthinger et al. 2013: "One VM to Rule Them All" (Onward! '13) — the Truffle vision paper  
- Würthinger et al. 2017: "Practical Partial Evaluation for High-Performance Dynamic Language Runtimes" (PLDI '17) — PE details
- Click & Paleczny 1995: "A Simple Graph-Based Intermediate Representation" — sea-of-nodes IR
- Duboscq et al. 2013: "Graal IR: An Extensible Declarative Intermediate Representation" (APPLC '13)

## See Also
- `memory/scratch/tracing-jit-compilation.md` — LuaJIT's tracing approach (complementary paradigm)
- `memory/scratch/copy-and-patch-jit.md` — CPython's template-stitching approach (simple end of spectrum)
- `lessons/dispatch-strategies.md` — optimization techniques for interpreted VMs
