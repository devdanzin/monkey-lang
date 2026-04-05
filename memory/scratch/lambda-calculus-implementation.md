# Lambda Calculus Implementation Notes
uses: 1
created: 2026-04-04
topics: lambda-calculus, type-theory, CPS, NbE, dependent-types, linear-types

## Architecture Decisions

### 10-Module Progression
Built as a learning ladder from untyped → dependent:
1. Untyped: core mechanics (substitution, reduction, Church encodings)
2. STLC: introduce types as static analysis
3. System F: parametric polymorphism (∀α.τ)
4. Bidirectional: better ergonomics (less annotation needed)
5. Linear: substructural (resource tracking)
6. Dependent: the most expressive (types depend on values)

Plus semantic companions:
7. Denotational: mathematical meaning via domain theory
8. Operational: step-by-step execution rules
9. CPS: explicit continuations
10. NbE: normalization using host language

### Key Implementation Insights

**Capture-avoiding substitution** is the hardest part of untyped lambda calculus. Fresh variable generation + checking free vars of replacement is essential.

**De Bruijn indices** solve alpha equivalence elegantly — two terms are alpha-equivalent iff their de Bruijn forms are structurally equal.

**NbE readback** must reset the fresh counter between the two sides of a conversion check, otherwise the generated names diverge and structurally-equal terms don't match.

**CPS call/cc** works by reifying the current continuation as a lambda that, when applied, ignores its own continuation and jumps to the captured one. Simple but powerful.

**Linear type checking** uses a threading model: context flows through the term from left to right, and each linear variable must be used exactly once. `!τ` marks unrestricted (copyable) types.

**Dependent type NbE**: conversion checking via readback is the right approach. Reset fresh counter before each readback to ensure consistent naming.

**Type:Type** is inconsistent (Girard's paradox) but simplifies the implementation enormously. Real implementations use universe levels.

### Test Count: 245
Untyped 52 + STLC 32 + System F 20 + Denotational 23 + Operational 23 + CPS 20 + NbE 16 + Bidirectional 22 + Linear 16 + Dependent 21
