# SAT Solver

A CDCL (Conflict-Driven Clause Learning) SAT solver built from scratch in JavaScript. Also includes a classic DPLL solver for comparison.

## Features

**CDCL Solver:**
- Two-watched literal scheme for efficient unit propagation
- 1UIP (First Unique Implication Point) conflict analysis
- Non-chronological backjumping
- VSIDS branching heuristic with geometric decay
- Geometric restart strategy
- Clause learning with activity bumping

**Also includes:**
- Classic DPLL solver (for comparison/educational use)
- DIMACS CNF parser and formatter
- Model verification
- Problem generators: N-Queens, pigeonhole principle, random k-SAT
- Graph coloring and Sudoku SAT encodings (in tests)

## Usage

### CLI

```bash
# Solve a DIMACS CNF file
node cli.js problem.cnf

# Run benchmarks (DPLL vs CDCL)
node cli.js --bench

# Solve N-Queens
node cli.js --queens 10

# Prove pigeonhole principle UNSAT
node cli.js --pigeon 5

# Random 3-SAT
node cli.js --random 50 213    # 50 vars, 213 clauses (near phase transition)
```

### Library

```javascript
import { solve, CDCLSolver, verify, parseDIMACS, nQueens, pigeonhole } from './src/index.js';

// Quick solve
const result = solve([[1, 2], [-1, 3], [-2, -3]]);
console.log(result.sat);   // true
console.log(result.model);  // Map { 1 => true, 2 => false, 3 => true }

// Full CDCL solver with stats
const { clauses, numVars } = nQueens(8);
const solver = new CDCLSolver(numVars, clauses);
const r = solver.solve();
console.log(r.stats);
// { decisions: 11, propagations: 185, conflicts: 8, learned: 8, restarts: 0 }

// Model verification
console.log(verify(clauses, r.model));  // true

// DIMACS format
const dimacs = parseDIMACS('p cnf 3 2\n1 -2 0\n2 3 0');
```

## Architecture

### Two-Watched Literals

Instead of scanning every clause during propagation, each clause tracks two "watched" literals. When a watched literal becomes false, the solver either:
1. Finds a new non-false literal to watch (O(1) skip for satisfied clauses)
2. Detects a unit clause and propagates
3. Detects a conflict

This makes propagation dramatically faster on large instances.

### 1UIP Conflict Analysis

When a conflict occurs, the solver walks the implication graph backward from the conflict clause, resolving literals at the current decision level until exactly one remains (the First UIP). The resulting learned clause captures the reason for the conflict and enables non-chronological backjumping.

### VSIDS (Variable State Independent Decaying Sum)

Variables appearing in learned clauses get their activity bumped. The branching heuristic picks the unassigned variable with the highest activity, focusing search on recently-relevant variables.

## Benchmarks

```
Problem                     DPLL        CDCL   Speedup  Result
------------------------------------------------------------------
4-Queens                   4.2ms      14.1ms      0.3x  SAT
8-Queens                  30.7ms       2.2ms     13.7x  SAT
PHP(4,3)                   0.4ms       0.9ms      0.5x  UNSAT
PHP(5,4)                   1.4ms       1.4ms      0.9x  UNSAT
Random 50v/200c           24.8ms       0.7ms     34.9x  SAT
```

CDCL overhead is noticeable on tiny instances but pays off dramatically as problem size grows. The 50-variable random instance shows 35x speedup from clause learning.

## Tests

```bash
npm test    # 69 tests across 13 suites
```

Test coverage includes:
- Basic SAT/UNSAT, unit propagation, implication chains
- DPLL vs CDCL agreement across varied formulas
- N-Queens (1 through 8, plus UNSAT cases 2, 3)
- Pigeonhole principle (PHP(2,1) through PHP(5,4))
- Graph coloring (K3, K4, bipartite, Petersen graph)
- 4x4 Sudoku (valid + contradiction detection)
- Random 3-SAT with agreement verification
- Clause learning, VSIDS activity, restart behavior
- Edge cases: XOR ladders, deep implications, large clauses

## DIMACS Format

Standard input format for SAT solvers:

```
c comment line
p cnf <num_vars> <num_clauses>
1 -2 3 0        # clause: x1 OR (NOT x2) OR x3
-1 2 0          # clause: (NOT x1) OR x2
```

## References

- MiniSat paper: Eén & Sörensson (2003) — the gold standard for CDCL implementation
- Knuth, TAOCP 7.2.2.2 — SAT solving algorithms
- Handbook of Satisfiability (2009) — comprehensive reference
