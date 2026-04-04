# Hindley-Milner Type Inference Notes

uses: 1
created: 2026-04-04
topics: type-inference, hindley-milner, algorithm-w, unification, polymorphism

## Algorithm W — The Key Steps

1. **Literals**: trivial — return known type
2. **Variables**: lookup in env, instantiate if polymorphic (replace ∀-bound vars with fresh ones)
3. **Lambda (fn x => e)**: create fresh TVar for x, infer e in extended env, return TFun(x_type, e_type)
4. **Application (f x)**: infer both, unify f_type with TFun(x_type, fresh_result)
5. **Let (let x = e1 in e2)**: infer e1, GENERALIZE it, infer e2 with generalized binding
6. **Let-rec**: bind name to fresh var, infer value, unify, generalize, infer body

## Let-Polymorphism — Why It Matters

The generalization step in `let` is what makes ML-family type systems powerful:
- `let id = fn x => x in (id 42, id true)` ✓ — id is generalized to ∀a. a→a
- `(fn id => (id 42, id true)) (fn x => x)` ✗ — lambda-bound id is NOT generalized

Generalize = quantify over type variables NOT free in the environment.

## Substitution Composition

`composeSubst(s1, s2)` means: apply s1 to all types in s2, then add s1's own bindings.
This ensures that when you do `t.apply(composed)`, it's equivalent to `t.apply(s2).apply(s1)`.

Critical: get the order right! s2 is applied first (inner), s1 second (outer).

## Pattern Matching Type Inference

For `match e with p1 => e1 | p2 => e2`:
1. Infer scrutinee type
2. For each case: infer pattern type + extract bindings, unify with scrutinee
3. Infer each body in env extended with pattern bindings
4. Unify all body types together
5. Result is the unified body type

Constructor patterns need to look up the constructor's type scheme in the environment and instantiate it.

## Occurs Check

Before binding `a = T`, check that `a` doesn't appear in `T`. Without this, you get infinite types like `a = a -> a` which would loop forever during substitution.
