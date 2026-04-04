# SMT Solver Architecture — DPLL(T) Research Notes

uses: 1
created: 2026-04-04
topics: smt, dpll-t, theory-solver, sat, constraint-solving

## DPLL(T) Architecture

Two components that cooperate:
1. **Boolean SAT engine (CDCL)** — handles propositional abstraction
2. **Theory solver(s)** — check consistency of theory atoms

### Abstraction
Each theory atom (`x + y > 5`, `a = b`) gets a fresh Boolean variable. SAT solver works on Boolean skeleton. When it finds a satisfying assignment, passes theory literals to theory solver.

### Theory Solver Interface (SolverT)
Must implement:
- `SetTrue(literal)` — assert a theory literal (incremental)
- `CheckConsistency()` → SAT/UNSAT
- `Propagate()` → list of implied theory literals
- `ExplainConflict()` → minimal subset causing UNSAT (becomes learned clause)
- `ExplainPropagation(lit)` → why this literal is implied
- `Backtrack(level)` — revert to decision level

Key requirement: **incremental + backtrackable**

### Simplest Theory: EUF (Equality + Uninterpreted Functions)
- Union-Find for equivalence classes
- SetTrue(a = b): union(a, b)
- CheckConsistency: for each disequality a ≠ b, check if same class → conflict
- Propagate: congruence closure (f(a) = f(b) when a = b)
- Backtrack: union-find with history stack (undo unions)

### Next Theory: Linear Integer Arithmetic (LIA)
- Simplex for checking consistency
- Bounds propagation
- Branch-and-bound for integer constraints

## Implementation Plan (Future)
1. Build EUF theory solver with backtrackable Union-Find
2. Integrate with existing CDCL via DPLL(T) framework
3. Parse SMT-LIB format (S-expressions)
4. Add LIA theory solver
5. Theory combination (Nelson-Oppen)

## References
- "Abstract DPLL and Abstract DPLL Modulo Theories" — Nieuwenhuis, Oliveras, Tinelli
- Stanford CS257 slides on DPLL(T)
- Z3 and CVC4/CVC5 architectures
