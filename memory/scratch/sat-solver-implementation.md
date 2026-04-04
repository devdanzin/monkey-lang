# SAT Solver Implementation Notes

uses: 1
created: 2026-04-04
topics: sat, cdcl, conflict-analysis, watched-literals, vsids

## 1UIP Conflict Analysis — The Subtle Bug

The standard 1UIP algorithm walks the trail backwards, resolving current-level literals until exactly one remains (the UIP). The critical detail:

**Wrong approach:** Use a flag/separate scan to find the UIP after the resolution loop. This can find an already-resolved variable if you restart the trail scan.

**Correct approach (MiniSat-style):** Maintain a `counter` of unresolved current-level literals. Walk trail backwards with a single `trailIdx` pointer. When you find a seen current-level literal, decrement counter. If counter === 0, that's the UIP — stop (don't resolve it). If counter > 0, resolve by adding its reason clause literals to the frontier.

Key insight: the resolution loop and the UIP search are the **same walk** — you never restart from the end of the trail.

## Two-Watched Literals

Each clause watches exactly 2 literals. When a watched literal becomes false:
1. Try to find a replacement (any non-false literal at position ≥ 2)
2. If found: swap it to position 1, add clause to new literal's watch list
3. If not found: the other watched literal (position 0) is either:
   - True → clause satisfied, keep watching
   - Unset → unit propagation (assign it)
   - False → conflict

**Implementation detail:** When processing the watch list for a falsified literal, build a `newWatchList` to avoid iterator invalidation. Only clauses that stay on this literal's watch list get added to `newWatchList`. Clauses that found a replacement get added to the replacement literal's watch list instead.

**`qhead` pattern:** Don't use `_propagate()` with full clause scanning. Instead, maintain a `qhead` index into the trail — the next assignment to propagate. This makes propagation O(watches per falsified lit) instead of O(all clauses).

## Learned Clause Assertion

After backtracking and adding a learned clause, you must explicitly assert the UIP literal. The learned clause is unit at the backtrack level (all other literals are false), so the UIP literal gets forced. This is NOT handled by regular propagation because the clause was just added — it needs an explicit `_assign()` call.

## VSIDS Activity

Bump all variables in the learned clause. Multiply `activityInc` by 1.05 after each conflict (geometric decay). This makes recently-conflicting variables exponentially more active.
