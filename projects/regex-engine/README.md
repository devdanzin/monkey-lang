# Regex Engine

A regex engine built from scratch in JavaScript. Implements Thompson's NFA construction with DFA subset construction, Hopcroft DFA minimization, lazy DFA construction, and a full backtracking matcher for advanced features.

## Features

### Pattern Syntax

| Syntax | Feature |
|--------|---------|
| `abc` | Literals |
| `.` | Any character (except newline) |
| `\d`, `\w`, `\s` | Character classes (digit, word, space) |
| `\D`, `\W`, `\S` | Negated character classes |
| `[abc]`, `[a-z]`, `[^a-z]` | Character sets and ranges |
| `*`, `+`, `?` | Quantifiers (greedy) |
| `*?`, `+?`, `??` | Lazy quantifiers |
| `*+`, `++`, `?+` | Possessive quantifiers |
| `{n}`, `{n,}`, `{n,m}` | Counted repetition |
| `(...)` | Capturing group |
| `(?:...)` | Non-capturing group |
| `(?<name>...)` | Named capturing group |
| `\1`, `\2` | Backreferences |
| `\k<name>` | Named backreferences |
| `a\|b` | Alternation |
| `^`, `$` | Anchors (start, end) |
| `\b`, `\B` | Word boundary, non-boundary |
| `(?=...)` | Positive lookahead |
| `(?!...)` | Negative lookahead |
| `(?<=...)` | Positive lookbehind |
| `(?<!...)` | Negative lookbehind |
| `(?>...)` | Atomic group |
| `\t`, `\n`, `\r` | Escape sequences |

### Matching Engines

1. **Thompson NFA Simulation** — O(nm) time, handles most patterns efficiently
2. **DFA Subset Construction** — O(n) time after O(2^m) build, optimal for repeated matching
3. **Hopcroft DFA Minimization** — Smallest possible DFA
4. **Lazy DFA** — Builds DFA states on-demand, avoiding exponential state explosion
5. **Backtracking Matcher** — Required for backreferences, lazy quantifiers, atomic groups, and lookbehind

## Usage

```javascript
import { Regex } from './src/index.js';

// Basic matching
const r = new Regex('\\d{3}-\\d{4}');
r.test('555-1234');        // true (full match)
r.search('call 555-1234'); // { index: 5, match: '555-1234' }

// Capturing groups
const r2 = new Regex('(\\d+)-(\\d+)');
const result = r2.exec('42-100');
// result.groups: Map { 1 => '42', 2 => '100' }

// Named groups
const r3 = new Regex('(?<year>\\d{4})-(?<month>\\d{2})');
const m = r3.exec('2026-04');
// m.groups: Map { 'year' => '2026', 'month' => '04' }

// matchAll
const r4 = new Regex('[a-z]+');
r4.matchAll('hello world foo'); // [{match:'hello'}, {match:'world'}, {match:'foo'}]

// Replace
const r5 = new Regex('\\d+');
r5.replace('v1.2.3', 'X'); // 'vX.X.X'

// DFA modes
r.testDFA('555-1234');      // Compiled DFA (fastest for repeated matches)
r.testMinDFA('555-1234');   // Minimized DFA
r.testLazyDFA('555-1234');  // Lazy DFA (on-demand state construction)
```

## Architecture

### Thompson's NFA Construction

The pattern is parsed into an AST, then compiled to a non-deterministic finite automaton using Thompson's construction. Each regex operator maps to a small NFA fragment:

- **Concatenation**: chain fragments sequentially
- **Alternation**: fork with epsilon transitions
- **Star/Plus/Question**: loop with epsilon transitions
- **Groups**: mark group boundaries for capture

### Two-Phase NFA Simulation

The NFA simulator uses epsilon closure with position tracking:
1. **Epsilon closure**: expand to all states reachable via epsilon transitions, evaluating anchors, lookaheads, and lookbehinds during traversal
2. **Character step**: advance on matching transitions

### DFA Subset Construction

For patterns without backreferences, the NFA can be compiled to a DFA where each DFA state represents a set of NFA states. This gives O(n) matching time.

**Hopcroft minimization** further reduces the DFA to its minimal equivalent.

**Lazy DFA** builds states on-demand during matching, avoiding the exponential worst-case of full subset construction while still giving O(n) matching once states are cached.

### Backtracking Matcher

Advanced features (backreferences, lazy quantifiers, atomic groups, lookbehind) use a recursive backtracking matcher. It generates all possible match results ordered by preference (greedy-first or lazy-first), then picks the best.

**Atomic groups** cut backtracking by only keeping the first (preferred) result from the child match, preventing the regex from trying alternative paths.

**Lookbehind** works by trying all possible lengths behind the current position and checking if the lookbehind pattern matches the substring.

## Tests

```bash
node --test test/regex.test.js    # 169 tests
```

Test coverage includes:
- Basic matching: literals, dot, character classes, alternation
- Quantifiers: greedy, lazy, possessive, counted repetition
- Groups: capturing, non-capturing, named, backreferences
- Anchors: ^, $, \b, \B
- Lookaround: lookahead (positive/negative), lookbehind (positive/negative)
- Atomic groups and possessive quantifiers
- DFA compilation, minimization, lazy DFA
- Search, matchAll, replace, split
- Edge cases: catastrophic backtracking avoidance, empty patterns, large inputs
- DPLL vs NFA agreement

## Complexity

| Engine | Build Time | Match Time | Features |
|--------|-----------|-----------|----------|
| NFA | O(m) | O(nm) | All except backrefs |
| DFA | O(2^m) worst | O(n) | No backrefs, no lazy |
| Lazy DFA | O(nm) amortized | O(n) cached | No backrefs, no lazy |
| Backtracker | O(1) | O(2^n) worst | All features |

Where m = pattern length, n = input length.

## References

- Thompson, Ken (1968). "Regular Expression Search Algorithm"
- Hopcroft, John (1971). "An n log n algorithm for minimizing states in a finite automaton"
- Cox, Russ. "Regular Expression Matching Can Be Simple And Fast" (swtch.com/~rsc/regexp)
