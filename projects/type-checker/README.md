# type-checker 🔬

A Hindley-Milner type inference engine implementing Algorithm W. No type annotations needed — the system infers types automatically, including polymorphism.

## What It Does

```javascript
typeCheck('42')                          // → "Int"
typeCheck('fn x => x + 1')              // → "(Int -> Int)"
typeCheck('fn x => fn y => x')          // → "(t0 -> (t1 -> t0))"
typeCheck('let id = fn x => x in id 5') // → "Int"
```

The magic: `let id = fn x => x` gets type `forall a. a -> a` — the identity function works on *any* type. Then `id 5` instantiates it to `Int -> Int`.

## Features

### Type Inference (Algorithm W)
- **Unification** with occurs check (prevents infinite types)
- **Let-polymorphism** — `let` bindings get generalized types
- **Principal types** — always finds the most general type

### Supported Types
| Type | Example | Inferred From |
|------|---------|---------------|
| `Int` | `42` | Integer literals |
| `Bool` | `true` | Boolean literals |
| `String` | `"hello"` | String literals |
| `Unit` | `()` | Unit value |
| `a -> b` | `fn x => x + 1` | Lambda abstractions |
| `List<a>` | `[1, 2, 3]` | List literals |
| `Pair<a, b>` | `(1, true)` | Pair construction |
| `Tuple3<a,b,c>` | Tuple AST node | N-ary tuples |
| `Record{x,y}` | Record AST node | Named field records |

### Supported Expressions
- Integer, boolean, string, unit literals
- Lambda: `fn x => body`
- Application: `f x`
- Let binding: `let x = e1 in e2`
- Recursive let: `letrec f = e1 in e2`
- If-then-else: `if cond then e1 else e2`
- Binary operators: `+`, `-`, `*`, `/`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`
- Lists: `[1, 2, 3]`
- Pairs, tuples, records with field access
- Type annotations: `(expr : Type)`

### Built-in Functions
- `head : List a -> a`
- `tail : List a -> List a`
- `cons : a -> List a -> List a`
- `fst : Pair a b -> a`
- `snd : Pair a b -> b`
- `add : Int -> Int -> Int`
- `not : Bool -> Bool`

## How Algorithm W Works

### 1. Fresh Variables
Each unknown type gets a fresh variable: `t0`, `t1`, `t2`, ...

### 2. Constraint Generation
Walking the AST generates type constraints:
- `42` → type is `Int`
- `fn x => e` → type is `t_x -> t_body`, where `t_x` is fresh
- `f x` → `f : t_arg -> t_result`, `x : t_arg`, result: `t_result`

### 3. Unification
Constraints are solved by unification — finding a substitution that makes both sides equal:
- `unify(t0, Int)` → `{t0 := Int}`
- `unify(t0 -> t1, Int -> Bool)` → `{t0 := Int, t1 := Bool}`
- `unify(t0, t0 -> Int)` → **Infinite type error!** (occurs check)

### 4. Generalization
At `let` boundaries, free type variables are generalized:
```
let id = fn x => x       -- id : forall a. a -> a
in id 5                   -- instantiate: id : Int -> Int → result: Int
```

This is why `let` is special — lambda-bound variables are NOT generalized.

## Architecture

```
src/
├── index.js         — Types, Substitution, Unification, Algorithm W
│   ├── TVar, TCon   — Type representation
│   ├── Scheme       — Polymorphic type schemes (forall a. ...)
│   ├── Subst        — Type substitutions
│   ├── unify()      — Robinson's unification algorithm
│   ├── infer()      — Algorithm W implementation
│   └── typeCheck()  — Source string → type string
└── index.test.js    — 73 tests
```

## Usage

### From Source Code
```javascript
const { typeCheck } = require('./src/index.js');

typeCheck('1 + 2')                        // → "Int"
typeCheck('if true then 1 else 2')        // → "Int"
typeCheck('let x = 5 in x + 1')          // → "Int"
typeCheck('fn x => x + 1')               // → "(Int -> Int)"
```

### Programmatic API
```javascript
const { Expr, typeOf, resetFresh } = require('./src/index.js');

resetFresh();
const id = Expr.Lam('x', Expr.Var('x'));
typeOf(id).toString();  // → "(t0 -> t0)"

// Let-polymorphism
const prog = Expr.Let('id', id,
  Expr.Pair(
    Expr.App(Expr.Var('id'), Expr.Int(5)),
    Expr.App(Expr.Var('id'), Expr.Bool(true))
  )
);
typeOf(prog).toString();  // → "Pair<Int, Bool>"

// Recursive factorial
const fact = Expr.LetRec('fact',
  Expr.Lam('n',
    Expr.If(
      Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
      Expr.Int(1),
      Expr.BinOp('*', Expr.Var('n'),
        Expr.App(Expr.Var('fact'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1))))
    )
  ),
  Expr.Var('fact')
);
typeOf(fact).toString();  // → "(Int -> Int)"
```

## Type Errors

The checker catches:
- **Unbound variables**: `x + 1` → "Unbound variable: x"
- **Type mismatches**: `1 + true` → "Cannot unify Int with Bool"
- **Infinite types**: `fn x => x x` → "Infinite type: t0 ~ (t0 -> t1)"
- **Non-function application**: `42 5` → "Cannot unify Int with ..."
- **Branch mismatch**: `if true then 1 else "x"` → "Cannot unify Int with String"

## Tests

```bash
node --test src/index.test.js
```

73 tests covering types, substitution, unification, inference, polymorphism, records, tuples, and error cases.

## References

- Damas, L. & Milner, R. (1982). "Principal type-schemes for functional programs"
- Pierce, B. (2002). "Types and Programming Languages" (Chapter 22)
- Heeren, B. et al. (2002). "Generalizing Hindley-Milner Type Inference Algorithms"

## License

MIT
