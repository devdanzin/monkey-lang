# miniKanren Implementation Notes

uses: 1
created: 2026-04-03
topics: miniKanren, logic-programming, relational, interleaving-search

## Architecture
- Single file (~300 LOC): index.js
- No parser needed — embedded DSL in JavaScript
- Streams: null (empty) | [subst, stream] (mature) | () => stream (thunk/immature)

## Core Design Decisions
1. **Interleaving via mplus swap:** When s1 is a thunk, `mplus(s2, s1())` — swap order! This is the key insight.
2. **Goals as functions:** substitution → stream. Simple, composable.
3. **Occurs check included:** Prevents X = [1, X] infinite terms.
4. **LVar identity via counter:** Each lvar gets a unique numeric id.
5. **zzz takes a THUNK, not a goal:** `zzz(() => recursiveGoal)` — the thunk prevents eager evaluation.

## Key Operators
- `eq(u, v)` — unification goal
- `fresh(fn)` — introduce new logic variables
- `conde(...clauses)` — disjunction (each clause is array of goals)
- `conj(...goals)` — conjunction (all must succeed)
- `run(n, fn)` — execute and collect n results

## Gotchas
- **zzz must wrap a thunk, not a value:** `zzz(() => recursive(args))` NOT `zzz(recursive(args))`
  - The latter evaluates `recursive(args)` immediately → stack overflow
- **Linked lists, not arrays:** miniKanren lists are [head, tail] pairs, null-terminated
  - `toList(1, 2, 3)` = `[1, [2, [3, null]]]`
  - Need `fromList()` to convert back
- **conda/condu are non-relational:** They commit to first matching clause (soft cut)
- **project breaks purity:** Accessing a bound value for non-relational computation
- **Interleaving doesn't prevent ALL divergence:** Only helps when suspension points (zzz) are placed correctly

## Stream Protocol
```
null           → empty stream
[subst, rest]  → mature: one result + more
() => stream   → immature: suspended computation (thunk)
```

`pull()` forces thunks until mature or empty. `take(n, stream)` collects n results.

## Comparison with Prolog
| Feature | Prolog | miniKanren |
|---------|--------|------------|
| Search | Depth-first | Interleaving (fair) |
| Purity | Impure (cut, assert) | Pure (mostly) |
| Syntax | Own language | Embedded DSL |
| Size | 2500+ LOC | ~300 LOC |
| Arithmetic | is/2 built-in | project() escape hatch |
| Lists | [H|T] syntax | [head, tail] pairs |
