# Trace-Native Language Design Notes

## Core Idea
A language designed from the ground up to make trace compilation maximally effective.
Not "a language with a tracing JIT" but "a tracing JIT with a language."

## Design Principles
1. **Type stability**: every variable has a single type per scope
2. **Value semantics**: assignment copies, no aliasing
3. **Effect tracking**: IO/mutation explicit, pure code can be reordered
4. **Linear loops**: for/while are primitives with known iteration patterns
5. **Closed variants**: algebraic data types, no open inheritance

## Type System
- `Int`, `Float`, `Bool`, `String` — unboxed primitives
- `[T]` — arrays, contiguous memory
- `(T, U, ...)` — tuples, heterogeneous
- `{field: T, ...}` — records, named fields
- `enum Name { Variant1(T), Variant2(U) }` — algebraic data types
- `?T` — optional (sugar for `enum { Some(T), None }`)
- No null. No undefined. No implicit coercion.

## Control Flow
- `if/else` — must be exhaustive
- `match` — pattern matching, must be exhaustive
- `for x in collection { ... }` — iteration primitive
- `while condition { ... }` — loop primitive
- No goto, no break-with-value, no early return (functional core)

## Effect System (simplified)
- Pure functions: `fn add(a: Int, b: Int) -> Int`
- Effectful functions: `fn print(s: String) -> () with IO`
- Mutable bindings: `var x = 0` (local mutation only, no escaping)
- Array mutation: `arr.set(i, v)` returns new array (CoW internally)

## Trace Compilation Strategy
- Every loop is a trace candidate
- Guards specialize on: type tags, array lengths, enum variants
- LICM hoists invariant computations automatically
- Range check elimination works naturally (loops have explicit bounds)
- Inlining: function calls in traces get inlined if small enough
- Deoptimization: bail to interpreter at any guard failure

## Key Advantage Over Existing Languages
- **No polymorphism** at the value level — monomorphic traces are the only traces
- **No hidden allocations** — arrays use CoW, tuples are stack-allocated
- **No exception handling** — use Result/Option types instead
- **Explicit iteration** — `for x in arr` tells the compiler the exact access pattern

## MVP Scope
1. Lexer + Parser (Pratt parser, like Monkey)
2. Type checker (Hindley-Milner-ish, with mandatory annotations at boundaries)
3. Bytecode compiler
4. Stack-based VM with type tags
5. Tracing JIT with all Monkey JIT optimizations
6. REPL + file execution

## Name Ideas
- **Trail** — paths through code
- **Wire** — traces as wires
- **Beam** — focused path
- **Line** — straight-line execution

## Status: Idea stage
Depends on: continuing Monkey JIT development, blog posts as validation
Next step: write a formal grammar, implement lexer/parser for core language
