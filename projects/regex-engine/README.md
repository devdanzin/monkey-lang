# Regex Engine

A regex engine built from scratch in JavaScript, implementing Thompson's NFA construction algorithm with DFA subset construction and Hopcroft minimization.

## Features

- **Thompson NFA Construction** — Linear-time construction from regex AST
- **DFA Subset Construction** — Compiles NFA to deterministic finite automaton
- **Hopcroft Minimization** — Reduces DFA to minimal equivalent
- **Lazy DFA** — Builds DFA states on demand (amortized O(1) per character)
- **Backtracking Matcher** — Handles backreferences and lazy quantifiers
- **Capturing Groups** — Named and numbered groups with backreferences

### Supported Syntax

| Syntax | Description |
|--------|-------------|
| `abc` | Literal characters |
| `a\|b` | Alternation |
| `a*` `a+` `a?` | Quantifiers (zero+, one+, optional) |
| `a{3}` `a{2,4}` `a{2,}` | Counted repetition |
| `*?` `+?` `??` `{n,m}?` | Lazy quantifiers |
| `.` | Any character except newline |
| `[abc]` `[a-z]` `[^abc]` | Character classes |
| `\d` `\w` `\s` | Digit, word, space shortcuts |
| `\D` `\W` `\S` | Negated shortcuts |
| `\t` `\n` `\r` | Special characters |
| `(...)` | Capturing group |
| `(?:...)` | Non-capturing group |
| `(?<name>...)` | Named capturing group |
| `\1` ... `\9` | Backreferences |
| `^` `$` | Start/end anchors |
| `\b` `\B` | Word boundary / non-word-boundary |
| `(?=...)` | Positive lookahead |
| `(?!...)` | Negative lookahead |

## API

```js
import { Regex } from 'regex-engine';

const re = new Regex('(\\w+)@(\\w+)\\.(\\w+)');

// Full-string match test (NFA)
re.test('foo@bar.com')       // true
re.test('invalid')           // false

// DFA matching (O(n) guaranteed)
re.testDFA('foo@bar.com')    // true
re.testMinDFA('foo@bar.com') // true (minimized DFA)
re.testLazyDFA('foo@bar.com') // true (lazy DFA)

// Search (find first match in string)
re.search('email: foo@bar.com here')
// { index: 7, match: 'foo@bar.com' }

// Exec (full match with captured groups)
re.exec('foo@bar.com')
// ['foo@bar.com', 'foo', 'bar', 'com']

// ExecSearch (search with captured groups)
re.execSearch('email: foo@bar.com here')
// ['foo@bar.com', 'foo', 'bar', 'com', index: 7, input: '...']

// Find all non-overlapping matches
new Regex('[0-9]+').matchAll('a1b22c333')
// [{ index: 1, match: '1' }, { index: 3, match: '22' }, { index: 6, match: '333' }]

// Replace
new Regex('[0-9]+').replace('a1b2c3', '#')  // 'a#b#c#'

// Split
new Regex('\\s+').split('hello   world  foo')  // ['hello', 'world', 'foo']
```

### DFA Statistics

```js
const re = new Regex('(a|b)*c');
re.dfaStats
// { states: 3, minimizedStates: 2 }
```

### Named Groups

```js
const re = new Regex('(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})');
const m = re.exec('2026-04-03');
m.groups.year   // '2026'
m.groups.month  // '04'
m.groups.day    // '03'
```

### Backreferences

```js
// Detect repeated words
new Regex('(\\w+) \\1').test('the the')  // true

// Match HTML tags
new Regex('<([a-z]+)>[^<]*</\\1>').test('<b>bold</b>')  // true
```

## Architecture

```
Input String
     ↓
 [Parser] → AST (recursive descent)
     ↓
 [Compiler] → NFA (Thompson construction)
     ↓                    ↓
 [NFA Simulator]    [DFA Builder]
  (backtracking)     (subset construction)
                          ↓
                   [Hopcroft Minimizer]
                          ↓
                   [Lazy DFA Cache]
```

### Three Matching Engines

1. **NFA Simulation** — Default for simple patterns. O(nm) worst case where n=input length, m=NFA states. No catastrophic backtracking.
2. **Backtracking** — Used for patterns with backreferences or lazy quantifiers. Exponential worst case but handles full regex syntax.
3. **DFA** — O(n) matching after O(2^m) construction. Three variants: eager (full build), minimized (Hopcroft), lazy (on-demand).

## Tests

```bash
npm test
# 135 tests across 30 suites
```

## Implementation Notes

- NFA states use closures for character matching — flexible but prevents direct DFA alphabet enumeration
- DFA construction probes the ASCII charset to discover distinct transition groups
- Hopcroft minimization uses partition refinement on the DFA state graph
- Lazy DFA caches transitions per (state, character) pair, growing only as needed
- Backtracker returns all possible match results ordered by preference (greedy-first or lazy-first)

## License

MIT
