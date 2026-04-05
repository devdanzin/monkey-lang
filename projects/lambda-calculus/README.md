# Lambda Calculus — A Complete Type Theory Exploration

10 modules covering the full spectrum of lambda calculus, from untyped through dependent types.

## Modules

| Module | File | Tests | Description |
|--------|------|-------|-------------|
| **Untyped λ-calculus** | `lambda.cjs` | 52 | Parser, 3 reduction strategies, Church encodings, de Bruijn, SKI |
| **Simply-Typed (STLC)** | `stlc.cjs` | 32 | Type checker, evaluator, Int/Bool/Arrow, if/let/binops |
| **System F** | `system-f.cjs` | 20 | ∀α quantification, Λα abstraction, type application |
| **Denotational Semantics** | `denotational.cjs` | 23 | Domain theory, ⊥ bottom, Kleene fixed-point, ⟦·⟧ |
| **Operational Semantics** | `operational.cjs` | 23 | Small-step (→), big-step (⇓), derivation trees, confluence |
| **CPS Transform** | `cps.cjs` | 20 | Direct→CPS conversion, call/cc, abort semantics |
| **NbE** | `nbe.cjs` | 16 | Normalization by Evaluation, neutral/normal readback |
| **Bidirectional Types** | `bidir.cjs` | 22 | Infer (⇒) / check (⇐) modes, annotations |
| **Linear Types** | `linear.cjs` | 16 | ⊸ linear arrow, !τ unrestricted, ⊗ tensor, use-once |
| **Dependent Types** | `dependent.cjs` | 21 | Π/Σ types, Type:Type, Nat, NbE conversion checking |

**Total: 245 tests across 10 modules**

## Run Tests

```bash
for f in *.test.cjs; do echo "=== $f ===" && node "$f"; done
```

## Architecture

Each module is self-contained with its own AST, type system, and evaluator. They form a progression:

1. **Untyped** — Pure computation, no types
2. **STLC** — Simple types prevent some errors
3. **System F** — Polymorphism (parametric types)
4. **Bidirectional** — Better type inference (less annotation)
5. **Linear** — Resource tracking (use-once semantics)
6. **Dependent** — Types that depend on values (the most expressive)

The semantic modules complement these:
- **Denotational** — Mathematical meaning of programs
- **Operational** — Step-by-step execution rules
- **CPS** — Explicit continuations and control flow
- **NbE** — Efficient normalization using host language

## Key Concepts Demonstrated

- **Church encodings** — Data as pure functions (numerals, booleans, pairs)
- **Capture-avoiding substitution** — Correct variable handling
- **De Bruijn indices** — Canonical representation, no alpha issues
- **SKI combinators** — Computation without variables
- **Fixed points** — Recursion from non-recursive primitives
- **call/cc** — First-class continuations and abort
- **⊥ propagation** — Modeling divergence in domain theory
- **Confluence** — Small-step and big-step agree
- **Π types** — Functions whose return type depends on input
- **Σ types** — Pairs whose second component type depends on first
