# regex-engine 🔍

A regex engine built from scratch in JavaScript, implementing the full pipeline: parsing → NFA (Thompson's construction) → DFA (subset construction) → DFA minimization (Hopcroft's algorithm).

Plus: capture groups with backtracking, backreferences, and string utilities (replace, split, matchAll).

## Features

### Parsing
- Literals, dot (`.`), character classes (`[a-z]`, `[^abc]`)
- Quantifiers: `*`, `+`, `?`, `{n}`, `{n,m}`
- Grouping: `(...)` capturing, `(?:...)` non-capturing
- Alternation: `a|b`
- Anchors: `^`, `$`
- Escape sequences: `\d`, `\w`, `\s`, `\D`, `\W`, `\S`
- Backreferences: `\1`, `\2`, etc.

### Three Matching Engines

| Engine | Use Case | Speed | Features |
|--------|----------|-------|----------|
| **NFA** | Quick matching | Fast | Thompson's construction, O(nm) guarantee |
| **DFA** | Repeated matching | Fastest | Subset construction + Hopcroft minimization |
| **Backtracking** | Capture groups | Varies | Generator-based, supports backreferences |

### DFA Pipeline
```
Pattern → AST → NFA → DFA → Minimized DFA
  parse()   buildNFA()  nfaToDFA()  minimizeDFA()
```

### String Utilities
- `matchCaptures()` — Full match with group extraction
- `searchCaptures()` — Find first match anywhere
- `matchAll()` — Find all non-overlapping matches
- `replace()` / `replaceAll()` — With `$1`, `$2` backreferences
- `split()` — Split by regex pattern

## Architecture

```
src/
├── regex.js          — Parser + NFA construction (Thompson's)
├── dfa.js            — NFA→DFA + Hopcroft minimization
├── capture.js        — Backtracking matcher with capture groups
├── index.js          — Public API
├── regex.test.js     — 32 NFA matching tests
├── dfa.test.js       — 23 DFA conversion/minimization tests
├── capture.test.js   — 31 capture group/utility tests
└── edge.test.js      — 34 edge cases + NFA/DFA consistency
```

**120 tests total, all passing.**

## Usage

### Quick Matching (NFA)
```javascript
import { match, test } from './src/regex.js';

match('a+b', 'aaab');        // true (full string)
match('a+b', 'aaab extra');  // false
test('\\d+', 'hello 42');    // true (search anywhere)
```

### Compiled DFA (Fast, Repeated Use)
```javascript
import { compile } from './src/dfa.js';

const re = compile('[a-z]+@[a-z]+\\.[a-z]+');
re.match('alice@example.com');  // true
re.match('not-an-email');       // false
re.search('contact alice@example.com today');
// { match: true, start: 8, end: 25 }

// See DFA statistics
re.stats();
// { states: 12, transitions: 45, acceptStates: 1, alphabet: 27 }
```

### Capture Groups
```javascript
import { matchCaptures, searchCaptures, matchAll, replace, replaceAll, split } from './src/capture.js';

// Extract groups
matchCaptures('(\\d+)-(\\d+)', '123-456');
// ['123-456', '123', '456']

// Backreferences
matchCaptures('(\\w+)-\\1', 'hello-hello');
// ['hello-hello', 'hello']

// Search in text
searchCaptures('(\\d+)', 'price: $42.99');
// { match: '42', index: 8, groups: ['42', '42'] }

// Find all matches
matchAll('[a-z]+', 'hello world foo');
// [{ match: 'hello', ... }, { match: 'world', ... }, { match: 'foo', ... }]

// Replace with group references
replace('(\\w+):(\\w+)', 'key:value', '$2:$1');
// 'value:key'

replaceAll('\\d', 'h3ll0', 'X');
// 'hXllX'

// Split
split('[,;]+', 'a,b;;c,d');
// ['a', 'b', 'c', 'd']
```

## How It Works

### 1. Parsing
Recursive descent parser converts regex string to AST:
```
"(a|b)*c" → { type: 'concat', parts: [
  { type: 'star', child: { type: 'alt', left: {char:'a'}, right: {char:'b'} } },
  { type: 'char', char: 'c' }
]}
```

### 2. Thompson's NFA Construction
Each AST node becomes an NFA fragment with start and accept states:
- **Literal**: single transition
- **Alternation**: epsilon transitions to both branches
- **Kleene star**: epsilon loop
- **Concatenation**: chain fragments together

### 3. NFA Simulation
Simultaneously tracks all possible NFA states using epsilon-closure:
- O(nm) time guarantee (n = text length, m = pattern states)
- No catastrophic backtracking for standard patterns

### 4. Subset Construction (NFA → DFA)
Powerset construction converts NFA to DFA:
- Each DFA state represents a set of NFA states
- No epsilon transitions in the result
- Deterministic: exactly one transition per symbol per state

### 5. Hopcroft's Minimization
Partition-refinement algorithm finds the minimal DFA:
- Start: two partitions (accepting / non-accepting)
- Refine: split partitions where transitions disagree
- Result: fewest possible states with same language

### 6. Backtracking Matcher (for Captures)
Generator-based recursive descent over the AST:
- Yields all possible match positions (enables backtracking)
- Tracks capture group start/end positions
- Supports backreferences by comparing captured text

## Supported Syntax

| Syntax | Description | Example |
|--------|-------------|---------|
| `abc` | Literal characters | `abc` matches "abc" |
| `.` | Any character | `a.c` matches "abc", "axc" |
| `[abc]` | Character class | `[aeiou]` matches vowels |
| `[a-z]` | Range | `[0-9]` matches digits |
| `[^abc]` | Negated class | `[^0-9]` matches non-digits |
| `*` | Zero or more | `a*` matches "", "a", "aaa" |
| `+` | One or more | `a+` matches "a", "aaa" |
| `?` | Optional | `colou?r` matches "color", "colour" |
| `{n}` | Exactly n | `a{3}` matches "aaa" |
| `{n,m}` | Between n and m | `a{2,4}` matches "aa" to "aaaa" |
| `(...)` | Capture group | `(a+)` captures "aaa" |
| `(?:...)` | Non-capturing | `(?:a+)b` groups without capture |
| `\|` | Alternation | `cat\|dog` matches either |
| `^` | Start anchor | `^hello` |
| `$` | End anchor | `world$` |
| `\d` | Digit | `\d+` matches "123" |
| `\w` | Word char | `\w+` matches "hello_123" |
| `\s` | Whitespace | `\s+` matches spaces/tabs |
| `\1` | Backreference | `(.)\1` matches "aa", "bb" |
| `\\.` | Escaped literal | `\\.` matches "." |

## Tests

```bash
node --test src/*.test.js
```

## Known Limitations

- Anchors (`^`, `$`) work in full-match mode but not reliably in search mode
- No lookahead/lookbehind assertions
- No Unicode categories (`\p{L}`)
- Backreferences require backtracking engine (not in DFA mode)
- DFA doesn't handle wildcard `.` in subset construction (NFA mode handles it)

## License

MIT
