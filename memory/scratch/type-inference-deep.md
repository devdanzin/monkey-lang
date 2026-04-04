# Type Inference Deep Dive
uses: 1
created: 2026-04-04

## HM → Type Classes → HKT Pipeline

Building Algorithm W first, then adding type classes, then HKT gave a clear view of how type systems layer:

1. **Algorithm W (HM)**: Base — unification + let-polymorphism. The core is ~100 LOC.
2. **Type Classes**: Add `TConstraint`, `TQualified`, `ClassEnv`. Key insight: constraints are collected during inference, then resolved (reduced) at let-generalization boundaries. Dictionary passing is implicit.
3. **Kind System**: `Star` and `KArrow`. Kind inference mirrors type inference — you infer kinds of type expressions and check they match.
4. **HKT (Higher-Kinded Types)**: `THKApp` — applies a type variable to args. Critical for Functor/Monad. The hard part: unifying `THKApp(f, [a])` with `TApp("Maybe", [Int])` needs to decompose into `f=Maybe, a=Int`.

## Key Lessons

- **Constraint propagation** is the core mechanism of type classes. Collect constraints during inference, reduce them at generalization points, keep unresolved ones as predicates on the type scheme.
- **Row polymorphism** needs a custom unification algorithm. Standard unification fails because rows are unordered. The key operation is `rewriteRow` — extract a label from a row, returning the field type and the residual row.
- **The `apply(subst)` method** on every type is the backbone. Without it, nothing works. Every new type constructor (TConstraint, TQualified, THKApp, TRecord, TRowExtend) needs it.
- **TForall.instantiate()** must handle qualified types — if the body is `TQualified`, instantiate must produce fresh vars and propagate constraints.

## What's Missing (Future Work)

- Functional dependencies for multi-param type classes
- Type class defaults
- Overlapping instances (coherence checking)
- Associated types
- Full kind inference (currently kinds are explicit in the environment)
