# Logic Programming Beyond Prolog

uses: 1
created: 2026-04-03
topics: logic-programming, miniKanren, datalog, ASP, answer-set-programming

## Three Alternatives to Prolog

### 1. miniKanren — Pure Relational Programming
- **Key idea:** Minimal, embeddable logic DSL (in Scheme, Clojure, Python, JS)
- **Core:** ~5 operators (==, fresh, conde, run, disj/conj)
- **Purity:** No cut, no assert/retract — logically pure
- **Search:** Interleaving (fair) search, not depth-first — avoids infinite loops
- **Use case:** Relational programming, program synthesis, type habitation
- **Key paper:** "The Reasoned Schemer" by Friedman, Byrd, Kiselyov
- **Possible project:** Build miniKanren in JS, compare with my Prolog

### 2. Datalog — Logic as Database Queries
- **Key idea:** Restricted Prolog for querying deductive databases
- **Restrictions:** No compound terms (f(x) not allowed), finite, guaranteed termination
- **Evaluation:** Bottom-up (not top-down like Prolog) — compute all facts then answer
- **Fully declarative:** Rule order doesn't matter (unlike Prolog)
- **Use cases:** Data integration, program analysis (e.g., Soufflé for points-to analysis), networking
- **Real systems:** Datomic, TerminusDB, Soufflé, LogicBlox
- **Possible project:** Build a Datalog engine with semi-naive evaluation

### 3. Answer Set Programming (ASP) — Non-Monotonic Reasoning
- **Key idea:** Find "stable models" (answer sets) of a logic program
- **Non-monotonic:** Adding info can retract conclusions (unlike Prolog)
- **Supports:** Classical negation AND negation-as-failure, choice rules, integrity constraints
- **Computation:** SAT-solver-inspired (grounding + solving)
- **Use cases:** Planning, diagnosis, scheduling, combinatorial optimization, NP problems
- **Real systems:** Clingo, DLV, s(CASP)
- **Possible project:** Build a simple ASP solver (ground + check stable models)

## Comparison Table

| Feature | Prolog | miniKanren | Datalog | ASP |
|---------|--------|------------|---------|-----|
| Search | Depth-first | Interleaving | Bottom-up | SAT-like |
| Terminates? | No guarantee | Better (fair search) | Always (finite) | Always (finite) |
| Purity | Impure (cut, assert) | Pure | Pure | Declarative |
| Negation | NAF (closed world) | No built-in | Stratified | Classical + NAF |
| Compound terms | Yes | Yes | No | Limited |
| Turing complete? | Yes | Yes | No | No (propositional) |

## Project Ideas (Ranked)
1. **miniKanren in JS** — Most educational, ties to existing Prolog work, ~200 LOC for core
2. **Datalog engine** — Interesting bottom-up evaluation, semi-naive optimization
3. **Simple ASP solver** — Most novel, hardest, would teach SAT-like techniques
