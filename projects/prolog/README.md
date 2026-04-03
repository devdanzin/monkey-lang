# Prolog Interpreter

A Prolog interpreter implemented in JavaScript with full unification, backtracking, and a standard Prolog parser.

## Features

- **Core:** Unification with occurs check, backtracking, cut
- **Arithmetic:** `is/2`, `+`, `-`, `*`, `/`, `mod`, `**`, math functions
- **Comparison:** `<`, `>`, `>=`, `=<`, `=:=`, `=\=`
- **Lists:** `append/3`, `member/2`, `length/2`, `reverse/2`, `sort/2`, `msort/2`, `nth0/3`, `nth1/3`, `last/2`
- **Control:** `not/1`, `once/1`, `call/1`, `forall/2`, if-then-else (`->`/`;`)
- **Meta:** `findall/3`, `assert/1`, `retract/1`, `functor/3`, `arg/3`, `=../2`, `copy_term/2`
- **Type checks:** `atom/1`, `number/1`, `integer/1`, `var/1`, `nonvar/1`, `compound/1`, `is_list/1`, `ground/1`
- **Strings:** `atom_chars/2`, `atom_length/2`, `atom_concat/3`, `char_code/2`, `number_chars/2`
- **Higher-order:** `maplist/2`, `between/3`, `succ/2`, `plus/3`
- **Parser:** Full Prolog syntax including lists `[H|T]`, operators, cut, comments

## Usage

### Programmatic API
```javascript
const { Prolog, atom, variable, compound, num } = require('./src/index.js');

const p = new Prolog();
p.addFact(compound('parent', atom('tom'), atom('bob')));
p.addRule(
  compound('ancestor', variable('X'), variable('Y')),
  compound('parent', variable('X'), variable('Y'))
);
const results = p.query(compound('ancestor', atom('tom'), variable('W')));
```

### Text-based (consult + queryString)
```javascript
const { Prolog } = require('./src/index.js');

const p = new Prolog();
p.consult(`
  parent(tom, bob).
  parent(bob, ann).
  grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
`);
const results = p.queryString('grandparent(tom, W)');
// [{W: {type: 'atom', name: 'ann'}}]
```

### Loading .pl files
```javascript
const fs = require('fs');
const { Prolog } = require('./src/index.js');

const p = new Prolog();
const results = p.consult(fs.readFileSync('examples/family.pl', 'utf8'));
```

## Tests

```bash
node --test
```

83 tests covering core unification, arithmetic, lists, classic programs (Fibonacci, factorial, quicksort, Tower of Hanoi, N-Queens, GCD, permutations, map coloring, Peano arithmetic, path finding).

## Examples

See `examples/` directory for sample Prolog programs:
- `family.pl` — Family relationships database
- `algorithms.pl` — Classic algorithms (fibonacci, quicksort, hanoi, GCD)
