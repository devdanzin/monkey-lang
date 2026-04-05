# DFA Construction and Minimization

uses: 1
created: 2026-04-05
status: active

## NFA → DFA: Subset Construction (Powerset Construction)

### Algorithm
1. Start: epsilon-closure of NFA start state = first DFA state
2. For each DFA state, for each alphabet symbol:
   a. Compute set of NFA states reachable via that symbol
   b. Take epsilon-closure of that set
   c. If new set not seen, create new DFA state
3. Mark DFA states as accepting if they contain any NFA accept state

### Key Insight
Each DFA state = a SET of NFA states. The DFA is deterministic because for any state+symbol, there's exactly one transition (to the new set of NFA states).

### Potential blowup: 2^n states from n NFA states. In practice, most are unreachable.

## DFA Minimization: Hopcroft's Algorithm

### Why minimize?
Subset construction can produce redundant states. Two DFA states are "equivalent" if they accept the same strings — they can be merged.

### Algorithm (partition refinement)
1. Initial partitions: {accepting states, non-accepting states}
2. For each partition P, for each symbol a:
   - Check if all states in P go to the same partition on `a`
   - If not, split P into groups that agree
3. Repeat until no more splits
4. Each final partition → one state in the minimal DFA

### Time complexity: O(n log n) where n = number of DFA states

## Implementation Notes

### Epsilon Closure
- BFS/DFS from a set of states, following only epsilon transitions
- Critical to do this at every step of subset construction
- Cache if performance matters (we don't, since construction is one-shot)

### Alphabet Detection
- Scan all NFA transitions to find all input symbols
- Wildcards (`.` in regex) need special handling — use a `dot: true` flag
- Bug we fixed: literal `.` characters were being treated as wildcards because `t.char === '.'` matched both

### State Set Key
- Convert set of NFA states to canonical string: sort IDs, join with commas
- Used as Map key for deduplication during subset construction

## Performance Results (our regex engine)
- DFA matching: 100-1000x faster than NFA simulation
- Minimization: typically removes 20-50% of states
- Native V8 RegExp: 2-6x faster than our DFA (JIT compiled C++ vs interpreted JS)
- Pathological patterns (a?^n a^n): DFA stays O(n), backtracking engines go exponential
