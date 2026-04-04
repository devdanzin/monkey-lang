# Type Inference Engine

A Hindley-Milner type inference engine implementing Algorithm W, built from scratch in JavaScript.

## Features

- **Algorithm W**: Complete type inference — no type annotations needed
- **Unification**: Robinson unification with occurs check
- **Let-polymorphism**: Generalize let-bound values, instantiate at each use
- **Recursive definitions**: `letrec` with proper fixpoint typing
- **Pattern matching**: Literal, variable, wildcard, and constructor patterns
- **Algebraic Data Types**: Sum types with named constructors
- **Binary operators**: Arithmetic, comparison, logical, polymorphic equality
- **Higher-order functions**: Proper inference for apply, compose, Church numerals

## Usage

```javascript
import { 
  infer, intLit, boolLit, varRef, lam, app, letExpr, letRec, 
  ifExpr, binOp, matchExpr, matchCase, pVar, pLit, pCon 
} from './src/index.js';

// Integer literal
infer(intLit(42));  // Int

// Lambda: fn x => x + 1
infer(lam('x', binOp('+', varRef('x'), intLit(1))));  // Int -> Int

// Polymorphic identity
infer(lam('x', varRef('x')));  // t0 -> t0

// Let-polymorphism
infer(
  letExpr('id', lam('x', varRef('x')),
    letExpr('a', app(varRef('id'), intLit(42)),
      letExpr('b', app(varRef('id'), boolLit(true)),
        varRef('b')
      )
    )
  )
);  // Bool — id used at both Int and Bool!

// Recursive factorial
infer(
  letRec('fact',
    lam('n', ifExpr(
      binOp('==', varRef('n'), intLit(0)),
      intLit(1),
      binOp('*', varRef('n'), app(varRef('fact'), binOp('-', varRef('n'), intLit(1))))
    )),
    varRef('fact')
  )
);  // Int -> Int

// Pattern matching
infer(
  matchExpr(intLit(42), [
    matchCase(pLit(0, 'int'), boolLit(true)),
    matchCase(pVar('x'), boolLit(false)),
  ])
);  // Bool
```

## Architecture

### Type Representation

| Type | Example | Description |
|------|---------|-------------|
| `TVar` | `a`, `t0` | Type variable (unknown type) |
| `TConst` | `Int`, `Bool` | Concrete type |
| `TFun` | `Int -> Bool` | Function type |
| `TList` | `[Int]` | List type |
| `TTuple` | `(Int, Bool)` | Tuple type |
| `TApp` | `Maybe Int` | Type constructor application |
| `TForall` | `∀ a . a -> a` | Polymorphic type scheme |

### Algorithm W

The core inference algorithm:

1. **Literals**: Return the known type (Int, Bool, String)
2. **Variables**: Look up in environment, instantiate if polymorphic
3. **Lambda (fn x => body)**: Create fresh type var for parameter, infer body
4. **Application (f x)**: Infer f and x, unify f with `argType -> resultType`
5. **Let (let x = e1 in e2)**: Infer e1, generalize, extend env, infer e2
6. **Let-rec**: Like let, but bind name to fresh var before inferring value
7. **If-then-else**: Condition must be Bool, branches must agree
8. **Match**: Scrutinee must match all patterns, branches must agree

### Unification

Robinson's algorithm with occurs check:
- `TVar` vs anything: bind (if passes occurs check)
- `TConst` vs `TConst`: must be same name
- `TFun` vs `TFun`: unify argument and return types
- `TApp` vs `TApp`: same constructor, unify args pairwise

### Let-Polymorphism

The key insight of Hindley-Milner: in `let x = e in body`, the type of `e` is **generalized** — type variables not appearing in the environment become universally quantified. Each use of `x` in `body` gets a fresh **instantiation**.

This is why `let id = fn x => x` allows `id(42)` and `id(true)` in the same scope, but `fn id => (id(42), id(true))` doesn't — lambda-bound values aren't generalized.

## Tests

```bash
npm test    # 54 tests
```

Covers: unification (basic, function, occurs check, lists, tuples, chaining), literal inference, variable lookup, lambda, application, binary operators, if-then-else, let-polymorphism, let-rec (factorial, fibonacci), higher-order functions (apply, compose, Church numerals), generalization, instantiation, data types, pattern matching.

## References

- Damas, L. & Milner, R. (1982). "Principal type-schemes for functional programs"
- Milner, R. (1978). "A Theory of Type Polymorphism in Programming"
- Pierce, B.C. (2002). "Types and Programming Languages" — Chapter 22
