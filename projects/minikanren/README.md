# miniKanren

A miniKanren relational logic programming implementation in JavaScript.

## What is miniKanren?

miniKanren is a minimal logic programming language that emphasizes *relational purity* and *fair search*. Unlike Prolog (which uses depth-first search and includes impure operators like `cut`), miniKanren uses interleaving search to ensure fair exploration of the solution space.

## Features

- **Unification** with occurs check
- **Interleaving search** — fair exploration, no infinite loops from naive recursion
- **Core operators:** `eq`, `fresh`, `conde`, `conj`, `disj`, `run`
- **Relational builtins:** `conso`, `firsto`, `resto`, `emptyo`, `membero`, `appendo`
- **Constraints:** `neq` (disequality), `symbolo`, `numbero`
- **Linked lists** with `toList`/`fromList` helpers
- **Suspension:** `zzz` for lazy recursive goals

## Usage

```javascript
const { run, runAll, eq, fresh, conde, conj, toList, fromList, membero } = require('./src/index.js');

// Simple query: what is q if q = 5?
run(1, q => eq(q, 5)); // [5]

// Multiple solutions
runAll(q => conde(
  [eq(q, 'tea')],
  [eq(q, 'coffee')],
  [eq(q, 'water')]
)); // ['tea', 'coffee', 'water']

// Relational: find all members of a list
runAll(q => membero(q, toList('a', 'b', 'c'))); // ['a', 'b', 'c']

// Relational append: split a list all possible ways
runAll(q => fresh((x, y) => conj(
  appendo(x, y, toList(1, 2, 3)),
  eq(q, [x, y])
))); // 4 ways to split [1,2,3]
```

## Tests

```bash
node --test
```

53 tests covering unification, goals, interleaving search, relational programming, linked lists, and constraints.

## Key Difference from Prolog

miniKanren's interleaving search means recursive goals don't infinite-loop:

```javascript
function always(q) {
  return conde(
    [eq(q, 'yes')],
    [zzz(() => always(q))] // lazy recursion
  );
}
run(3, q => always(q)); // ['yes', 'yes', 'yes'] — works!
// In Prolog with depth-first search, equivalent would diverge.
```
