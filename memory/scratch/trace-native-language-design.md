# Trace-Native Language Design

uses: 1
created: 2026-03-26
topics: language-design, tracing-jit, compiler, type-systems

## The Question

Existing languages weren't designed for tracing JITs — they were designed for humans, then we figured out how to JIT them. What if we designed a language *for* the trace compiler?

## What Tracing JITs Love

### 1. Type-stable operations
Traces record a specific type path. If `x + y` is always integer addition, the trace is beautiful — one operation, one guard at entry. If `x + y` could be int add, float add, string concat, or operator overloading... every call site needs a guard and the trace becomes a chain of checks.

**Trace-native:** Separate operators for different types. `+` for numbers, `++` or `~` for strings. Or: type annotations that the JIT can trust.

### 2. Predictable control flow
Traces follow one path. Branches cause side traces. Many branches = many side traces = poor performance.

**Trace-native:** Pattern matching over match expressions (exhaustive, predictable). Avoid deeply nested if/else chains. The language could have a "hot path hint" — `likely(condition)` — that tells the trace recorder which branch to record first.

### 3. Monomorphic call sites
A function call in a trace is cheap if it always calls the same function. Megamorphic dispatch (calling different functions at the same call site) is poison — the trace either records one variant and guards against others, or gives up.

**Trace-native:** No dynamic dispatch by default. No operator overloading. Method calls resolve statically. For polymorphism: use sum types + match, not virtual dispatch.

### 4. Value types / no boxing
Every time a primitive needs to become an object (boxing), the JIT has to either eliminate the box (optimization) or pay for allocation. If values are always unboxed...

**Trace-native:** Integers and floats are always value types. No `Integer` vs `int` distinction. Structs are value types by default (like Rust).

### 5. No hidden allocation
The biggest JIT killer in dynamic languages: hidden allocation everywhere. Creating closures, rest args, string operations, array slicing — each silently allocates.

**Trace-native:** Make allocation explicit. `let x = new Point(1, 2)` allocates. `x.y` doesn't. Closures that capture by value don't allocate (they're just fat function pointers). Array views/slices share backing storage.

### 6. Loops as first-class constructs
Tracing JITs detect loops and record them. The clearer the loop structure, the better.

**Trace-native:** Explicit loop constructs (`for`, `while`, `loop`). No implicit iteration via recursion (or mark tail calls so the JIT knows to convert to loops). Iterator protocol that the JIT can inline.

## What Tracing JITs Hate

### 1. Eval / dynamic code generation
You can't trace what doesn't exist yet.

### 2. Megamorphic dispatch
Virtual tables, duck typing, prototype chains. Each call site can target N functions — the trace records one and guards against others.

### 3. Exception-heavy control flow
Try/catch creates implicit control flow that traces must account for. Every operation that could throw is a potential side exit.

**Trace-native:** Result types instead of exceptions. `fn parse(s: str) -> Result<int, ParseError>`. Exceptions reserved for truly exceptional cases (programmer errors, OOM).

### 4. Global mutable state
If a function reads a global that could change between invocations, the trace must either guard on the value or reload it every time.

**Trace-native:** Globals are const by default. Mutable state is local or explicitly passed. Module-level "vars" require explicit `mut` and the JIT knows to guard them.

### 5. Property access with prototype chains
`obj.foo` in JS might: check own properties, walk prototype chain, trigger getter, call Proxy trap. The trace records ALL of that.

**Trace-native:** Struct fields at known offsets. No prototype chains. Interfaces/traits for polymorphism, but resolved at compile time.

## The Dream Language

```
// Types are explicit but inferred where possible
fn fibonacci(n: int) -> int {
    if n <= 1 { return n }
    fibonacci(n - 1) + fibonacci(n - 2)
}

// Sum types + match instead of inheritance
type Shape = Circle(radius: float) | Rect(w: float, h: float)

fn area(s: Shape) -> float {
    match s {
        Circle(r) => 3.14159 * r * r,
        Rect(w, h) => w * h,
    }
}

// Value structs (no heap allocation for small ones)
struct Point(x: float, y: float)

// Closures capture by value (no hidden allocation)
fn make_adder(n: int) -> fn(int) -> int {
    |x| => x + n    // n is captured by value
}

// Explicit iteration (JIT-friendly)
for i in 0..1000 {
    result += fibonacci(i)
}

// Result types instead of exceptions
fn parse_int(s: str) -> Result<int, Error> {
    // ...
}

// Module-level constants (free to inline)
const MAX_SIZE = 1024

// Mutable module state (JIT guards this)
mut counter: int = 0
```

### Key Properties:
1. **No boxing** — all primitives are values
2. **No hidden allocation** — you know when memory is allocated
3. **Monomorphic by default** — dispatch is static, polymorphism is opt-in via sum types
4. **Explicit mutability** — JIT knows what can change
5. **Result types over exceptions** — no hidden control flow
6. **Value semantics for small structs** — no heap overhead
7. **Clear loop constructs** — JIT identifies loops trivially

## Existing Languages That Get Close

- **Lua** — Simple type system, value types, designed with LuaJIT in mind
- **Julia** — Type-stable functions, multiple dispatch (monomorphizable), JIT-compiled
- **Rust** — No GC, monomorphization, value types, but not dynamically compiled
- **Dart** — Ahead-of-time + JIT, sound type system, no eval

## Connection to Monkey

Our Monkey JIT already benefits from several trace-friendly properties:
- Simple type system (int, bool, string, array, hash, fn)
- No prototype chains
- No eval
- Clear loop constructs

Where Monkey is trace-unfriendly:
- Dynamic typing (every operation needs type guards)
- Boxing (MonkeyInteger wraps JS number)
- Closures capture by reference (heap allocation)
- Hash access is essentially property access with string keys

If designing Monkey v2, the biggest win would be **optional type annotations** that the JIT can trust without guards.
