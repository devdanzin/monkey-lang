---
uses: 1
created: 2026-03-24
last-used: 2026-03-24
topics: language-design, trace-jit, programming-languages, type-systems
---

# What Would a Trace-JIT-Native Language Look Like?

## The Question

Most languages get tracing JITs bolted on later (Lua→LuaJIT, Python→PyPy, JS→TraceMonkey).
The language semantics fight the tracer at every turn: polymorphism, dynamic dispatch, prototype
mutation, eval(), with statements, etc.

What if we designed a language whose semantics HELP the tracer?

## Properties That Make Tracing Easy

### 1. Predictable Types (but not static)
The ideal: types that are *usually* stable but *can* change. This gives the tracer:
- High hit rate on type guards (types rarely change → guards rarely fail)
- Dynamic flexibility when needed (guards deopt cleanly)

**Anti-pattern**: Python's everything-is-a-dict. Type guards on attribute access are expensive because *any* attribute can be overridden at any time.

**Good pattern**: "Gradual shapes" — objects have a declared shape that's stable by default, but can be mutated with explicit syntax:
```
shape Point { x: int, y: int }
let p = Point(3, 4)        # shape is fixed — tracer knows layout
p.z = 5                     # ERROR: Point doesn't have z
p = p.extend({ z: 5 })     # OK: creates a new shape PointExt
```
The tracer only needs to guard on shape identity, not individual fields.

### 2. Value Types by Default
Objects are values (copied on assignment) unless explicitly shared. This means:
- Escape analysis is trivial: values can't alias, so they never "escape" through mutation
- Allocation sinking is always valid: no other reference can observe the intermediate state
- Loop variables are always promotable: copy semantics mean no hidden aliasing

```
let p = Point(3, 4)
let q = p               # q is a copy, not a reference
q.x = 10                # p.x is still 3
```

The tracer can keep `p` and `q` as register pairs without worrying about aliasing.

**Escape hatch**: `ref` keyword for shared mutable state (explicitly opt-in):
```
let r = ref Point(3, 4)  # heap-allocated, reference semantics
```

### 3. Deterministic Loops
The tracer's bread and butter. Language-level guarantees:
- `for` loops always have a countable bound (no unbounded iteration in `for`)
- `while` loops are the wild card (expected to be traced)
- No `goto` — loop structure is always visible to the tracer
- Iterator protocol is value-based (no hidden allocations for iterator state)

```
for x in 1..100 { ... }       # countable, tracer can unroll
for item in array { ... }      # iterator is a (ptr, end) pair, not an object
while condition() { ... }      # trace this
```

### 4. No Implicit Conversions
Implicit coercions are trace-killers — they create unexpected type transitions that guards must handle.
```
# Bad (JavaScript): "5" + 3 = "53", type of result depends on operand types
# Good: "5" + 3 is a compile error. int("5") + 3 = 8.
```

### 5. Sealed Globals
Global variables can be declared but not reassigned after module init:
```
const TAX_RATE = 0.08           # truly constant, inlined by tracer
let mut counter = 0              # mutable but explicitly marked
```
The tracer can treat `const` globals as constants (no guard needed), and only guard on `mut` globals.

### 6. Effects System for Side Effects
Side effects are the tracer's enemy — they create invisible dependencies and prevent reordering.
An effects system makes them explicit:
```
fn pure_add(a: int, b: int) -> int { a + b }          # no effects, freely reorderable
fn print_value(v: int) -> void with IO { print(v) }   # IO effect, order matters
fn read_counter() -> int with Mut { counter }          # reads mutable state
```
The tracer knows: pure functions can be CSE'd, reordered, eliminated. IO functions anchor the trace. Mut functions need guards on the mutable state.

### 7. Algebraic Data Types (NOT classes)
ADTs are perfect for tracing:
- Finite, known set of variants → guard is a tag check (one integer comparison)
- No inheritance → no vtable dispatch, no megamorphic call sites
- Pattern matching → naturally becomes a guard chain
```
type Shape =
  | Circle(radius: float)
  | Rect(width: float, height: float)

fn area(s: Shape) -> float =
  match s {
    Circle(r) => 3.14159 * r * r,     # guard: tag == Circle
    Rect(w, h) => w * h,               # guard: tag == Rect
  }
```
The tracer records which variant it saw, guards on the tag, and inlines the matching arm.

### 8. No eval/exec
`eval()` makes the tracer's life impossible — any code can appear at any point. Remove it entirely.
Metaprogramming happens at compile time via macros or const evaluation.

### 9. Transparent Numeric Representation
The language has one number type that the implementation can represent however it wants:
- Small integers → unboxed machine integers
- Big integers → heap-allocated bigints
- Floats → machine doubles
Transitions between representations are implicit but PREDICTABLE (overflow detection, etc).
The tracer can specialize on the actual representation observed.

## What This Language Would Feel Like

Something between Rust (value types, algebraic data types, no GC by default) and Lua (simple, embeddable, dynamic feel) with hints of OCaml (pattern matching, effects).

```
# Fibonacci with trace-friendly semantics
fn fib(n: int) -> int =
  if n <= 1 then n
  else fib(n - 1) + fib(n - 2)

# Hot loop — tracer's paradise
fn sum_points(points: [Point]) -> int =
  let mut total = 0
  for p in points {         # iterator = pointer pair, no allocation
    total = total + p.x + p.y   # all values, no boxing
  }
  total

# Side trace scenario
fn process(shapes: [Shape]) -> float =
  let mut total = 0.0
  for s in shapes {
    total = total + area(s)  # guard on tag, inline matching arm
  }                          # rare variant → side trace
  total
```

## Why This Matters

This isn't just academic. The insight is: **language semantics determine JIT ceiling.**
- LuaJIT is fast partly because Lua is simple (few types, no classes, no inheritance)
- V8 is complex partly because JavaScript is complex (prototypes, coercions, eval)
- PyPy struggles partly because Python has too many implicit protocols (__getattr__, __add__, etc.)

A language designed for tracing would get LuaJIT-level performance with more expressive features.

## Open Questions
1. Can you have both value types AND GC? (Rust says no GC, but that's hostile to dynamic use)
2. How do closures work with value semantics? (Capturing by value is safe but limiting)
3. Can pattern matching + guards handle hot polymorphism without megamorphic blowup?
4. Is this just Rust with a tracing JIT? (Maybe. But Rust doesn't need a JIT — it's already compiled.)

## The Rabbit Hole
This could become a real project: design and implement a small language with these properties,
targeting JS codegen (like Monkey), and see if the trace-friendly semantics actually produce
simpler, faster JIT output. Hypothesis: the JIT would be ~50% simpler than Monkey's because
the language does half the work.
