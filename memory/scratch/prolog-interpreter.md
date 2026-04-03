# Prolog Interpreter — Implementation Notes

uses: 1
created: 2026-04-03
topics: prolog, unification, backtracking, logic-programming, parser

## Architecture
- Three files: terms.js (term types), parser.js (tokenizer + Pratt parser), index.js (engine)
- Terms: Atom, Var, Num, Compound, Cut, NIL
- Lists are nested Compound('.', [head, tail]) with NIL as terminator
- Substitutions are Map<string, Term> — immutable copies on extend

## Unification
- walk() follows var bindings, deepWalk() recursively resolves
- Occurs check prevents X = f(X) infinite terms
- Key: always walk before comparing, create new Map on extend (immutable)

## Backtracking via Generators
- _solve() is a generator that yields substitutions
- Perfect fit: lazy evaluation of search space
- Each clause tried in order; on failure, generator resumes at next clause
- Cut would need special signal handling (CutSignal class)

## Parser Precedence (Standard Prolog)
- `;` (disjunction) = 1100, `->` (if-then) = 1050
- `=`, `is`, comparisons = 700
- `+`, `-` = 500, `*`, `/`, `mod` = 400
- Bug: initially had `;` and `->` at 700 → broke if-then-else parsing
- Fix: match ISO Prolog precedence table exactly

## Builtins Pattern
- _tryBuiltin() is a regular function returning generator|null
- Individual builtins are generator methods (*_builtin_xxx)
- Uniform interface: yield solutions, compose with user predicates
- 40+ builtins: arithmetic, comparison, lists, meta, control, types, strings

## Variable Renaming
- Every clause use needs fresh variables (_rename with mapping)
- Without this, shared variables across derivation steps = wrong answers
- Fresh vars: _G0, _G1, _G2... (counter-based)

## Gotchas
- Generator function always returns iterator, never null → can't use *_tryBuiltin as dispatcher
- List operations need _listToArray helper (follow '.' chain to '[]')
- Parser: negative numbers need context (check if previous token allows unary minus)
- assert/retract modify this.clauses array directly — affects ongoing search
