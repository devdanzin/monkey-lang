# SMT Solver

An SMT (Satisfiability Modulo Theories) solver built from scratch in JavaScript, using the DPLL(T) architecture with a CDCL-style Boolean engine and an EUF (Equality with Uninterpreted Functions) theory solver.

## Architecture

### DPLL(T) Framework

The solver follows the standard DPLL(T) architecture:

1. **Boolean Engine** — handles propositional reasoning (decisions, unit propagation, backtracking)
2. **Theory Solver** — checks consistency of theory atoms, detects conflicts, propagates implications
3. **Integration Layer** — maps between Boolean variables and theory literals via abstraction

### EUF Theory Solver

The EUF solver implements congruence closure using:

- **Backtrackable Union-Find** — maintains equivalence classes with checkpoint/backtrack support
- **Congruence propagation** — when `a = b`, automatically propagates `f(a) = f(b)` for all known function applications
- **Conflict detection** — detects when an equality assertion violates a disequality constraint

### SMT-LIB Parser

Full S-expression parser for the SMT-LIB 2.0 input format, supporting:
- `declare-const`, `declare-fun`
- `assert` with `=`, `not`, `distinct`, `and`, `or`, `=>`
- Nested function applications
- Comments and string literals

## Usage

### SMT-LIB Input

```javascript
import { solveSmt } from './src/index.js';

const result = solveSmt(`
  (set-logic QF_UF)
  (declare-fun f (Int) Int)
  (declare-const a Int)
  (declare-const b Int)
  (assert (= a b))
  (assert (not (= (f a) (f b))))
  (check-sat)
`);

console.log(result.sat); // false — congruence makes f(a)=f(b) when a=b
```

### Programmatic API

```javascript
import { DPLLTSolver, term, eq, neq } from './src/index.js';

const solver = new DPLLTSolver();
const a = term('a'), b = term('b'), c = term('c');
const fa = term('f', a), fb = term('f', b);

solver.euf.register(fa);
solver.euf.register(fb);

solver.assert(eq(a, b));
solver.assert(neq(fa, fb));

const result = solver.solve();
console.log(result.sat);   // false
console.log(result.stats);  // { decisions, propagations, theoryConflicts, backtracks }
```

### EUF Solver Standalone

```javascript
import { EUFSolver, term, eq, neq } from './src/index.js';

const euf = new EUFSolver();
const a = term('a'), b = term('b'), c = term('c');
const fa = term('f', a), fb = term('f', b);

euf.register(fa);
euf.register(fb);

euf.pushLevel();
euf.setTrue(eq(a, b));
console.log(euf.areEqual(fa, fb)); // true — congruence closure

euf.popTo(0);
console.log(euf.areEqual(fa, fb)); // false — backtracked
```

## Theory

### Equality with Uninterpreted Functions (EUF)

EUF combines:
- **Equality**: reflexive, symmetric, transitive (`a=b, b=c ⟹ a=c`)
- **Congruence**: `a=b ⟹ f(a)=f(b)` for any function `f`
- **Disequality**: `a≠b` asserts two terms are in different equivalence classes

The theory solver uses **congruence closure** — a Union-Find structure augmented with a signature table that tracks function applications and propagates equalities when argument representatives change.

### Backtrackable Union-Find

Standard Union-Find (with union by rank and path compression) extended with:
- **History stack**: records all parent/rank changes
- **Checkpoints**: marks positions in the history for backtracking
- **backtrackTo(level)**: unwinds all changes back to a given checkpoint

This is essential for the DPLL(T) architecture where the SAT engine frequently backtracks during search.

## Tests

```bash
npm test    # 56 tests across 12 suites
```

Covers:
- Union-Find: basic operations, transitive connections, multi-level backtracking
- EUF: equality, transitivity, congruence (nested, multi-arg, chain), conflict detection
- DPLL(T): Boolean+theory integration, AND/OR/implies, theory conflicts
- SMT-LIB: S-expression parsing, end-to-end from SMT-LIB input to SAT/UNSAT

## Supported Logic

**QF_UF** — Quantifier-Free Uninterpreted Functions

Future work:
- QF_LIA — Linear Integer Arithmetic (Simplex)
- QF_UFLIA — Combined EUF + LIA
- Quantifiers (∀, ∃)

## References

- Nieuwenhuis, Oliveras, Tinelli. "Abstract DPLL and Abstract DPLL Modulo Theories" (2004)
- de Moura, Bjørner. "Z3: An Efficient SMT Solver" (2008)
- Barrett, Tinelli. "Satisfiability Modulo Theories" (Handbook of Model Checking, 2018)
