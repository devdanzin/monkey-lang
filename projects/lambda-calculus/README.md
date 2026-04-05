# Lambda Calculus Interpreter

Pure untyped lambda calculus interpreter with multiple reduction strategies, Church encodings, de Bruijn indices, and SKI combinators.

## Features

### Core
- **Parser** — `λx.body` and `\x.body` syntax, parenthesized expressions, multi-param sugar
- **AST** — Var, Abs (abstraction), App (application)
- **Pretty printer** — Readable output with minimal parentheses
- **Free variables** — Compute free variable sets
- **Alpha conversion** — Rename bound variables
- **Alpha equivalence** — Compare terms up to renaming (via de Bruijn)
- **Capture-avoiding substitution** — Automatic renaming to prevent variable capture

### Reduction Strategies
- **Normal order** — Leftmost, outermost redex first (finds normal form if one exists)
- **Applicative order** — Leftmost, innermost redex first (eager evaluation)
- **Call-by-value** — Only reduces when argument is a value (models real languages)
- **Step limiting** — Configurable max steps to detect divergence
- **Reduction trace** — Records every step for visualization

### Church Encodings
- **Booleans** — true, false, and, or, not, if
- **Numerals** — zero through three, successor, plus, mult, pow, predecessor, isZero
- **Pairs** — pair, fst, snd
- **Conversion** — `toNumber`, `toBool`, `fromNumber` for interop with JS

### De Bruijn Indices
- Convert named terms to de Bruijn representation
- Pretty print de Bruijn terms
- Used internally for alpha equivalence

### Combinators
- **S** — `λx y z.x z (y z)` (substitution)
- **K** — `λx y.x` (constant)
- **I** — `λx.x` (identity)
- **B** — `λf g x.f (g x)` (composition)
- **C** — `λf x y.f y x` (flip)
- **W** — `λf x.f x x` (duplicate)
- **Y** — Fixed-point combinator (recursion)
- **Ω** — `(λx.x x)(λx.x x)` (divergence)

## Examples

```javascript
const { parse, reduce, prettyPrint, church } = require('./lambda.cjs');

// Identity applied to a
const { result } = reduce(parse('(λx.x) a'));
prettyPrint(result); // "a"

// Church arithmetic: 2 + 3 = 5
const sum = new App(new App(church.plus, church.two), church.three);
church.toNumber(reduce(sum).result); // 5

// S K K = I (classic proof)
const skk = parse('(λx y z.x z (y z)) (λx y.x) (λx y.x)');
const applied = new App(reduce(skk).result, new Var('a'));
reduce(applied).result.name; // "a"
```

## Tests

```bash
node lambda.test.cjs
```

52 tests covering parser, reduction strategies, Church encodings, de Bruijn indices, combinators, divergence detection.

## Theory

The untyped lambda calculus is the simplest Turing-complete programming language. Every computable function can be expressed using only three constructs: variables, abstraction (function definition), and application (function call).

**Normal order** always finds a normal form if one exists (Church-Rosser theorem), but may be inefficient. **Applicative order** can diverge on terms that have a normal form (e.g., `(λx.a) Ω`). **Call-by-value** models how most real programming languages work.
