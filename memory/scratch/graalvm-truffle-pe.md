---
uses: 1
created: 2026-03-21
last-used: 2026-03-21
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
