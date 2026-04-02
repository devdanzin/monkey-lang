# Micro-Project Audit

215 repos total. Categorized by substance.

## Tier 1: Deep Projects (substantial, portfolio-worthy)
Worth pinning, blogging about, linking prominently.

| Project | LOC | Tests | Why it's interesting |
|---------|-----|-------|---------------------|
| monkey-lang | 20122 | 1496+ | Full language: 5 backends, tracing JIT, WASM compiler |
| ray-tracer | 4029 | 194 | Path tracer: importance sampling, microfacet BRDF, BVH |
| neural-net | 2072 | 108 | From scratch: RNN/LSTM, GAN, Adam, BatchNorm, serialization |
| physics | 529 | 74 | 2D engine: SAT, CCD, constraints, sleeping, raycasting |
| webread | — | — | Published CLI tool, actual users (v0.3.0) |
| openclaw | 5486 | — | 9 PRs to real open source project |

## Tier 2: Interesting Mid-Size (teach a concept well)
Worth a README, could be referenced in a "things I built" post.

| Project | LOC | What's interesting |
|---------|-----|--------------------|
| chip8 | 320 | Full emulator — CPU, display, input, timers |
| regex-engine | 330 | Thompson NFA construction |
| type-infer | 260 | Hindley-Milner type inference |
| http-server | 280 | Raw TCP → HTTP from scratch |
| btree | 402 | B-tree with splitting/merging |
| vm | 204 | Stack VM with assembler |
| tiny-vm | — | Another VM variant |
| lisp | — | Lisp interpreter |
| brainfuck | — | Brainfuck interpreter |
| automaton | 229 | DFA with minimization |
| ecs | — | Entity Component System |
| vdom | — | Virtual DOM diffing |
| promise | — | Promise/A+ spec implementation |
| regex | 411 | Regex utilities |
| json-parser | 217 | JSON parser from scratch |
| template-engine | 234 | Mustache/Handlebars-like |
| schema | 265 | Zod/Joi-like validator |
| huffman | — | Huffman encoding |
| sha256 | — | SHA-256 from scratch |
| sql | 218 | SQL query execution |
| raft | — | Raft consensus (if implemented) |
| crdt | — | CRDTs |
| elf-parser | — | ELF binary parser |
| autograd | — | Automatic differentiation |
| game-engine | — | Game engine |
| signals | — | Solid.js-style reactivity |
| observable | — | RxJS-lite reactive streams |
| parser-combinator | — | Monadic parser combinators |
| css-parser | — | CSS parser |
| cron-parser | 202 | Cron expression parser |
| spreadsheet | — | Spreadsheet engine |
| rate-limiter | 241 | Token bucket + sliding window |
| di | 203 | Dependency injection container |

## Tier 3: Standard Data Structures / Utilities (derivative)
Well-implemented but anyone could build these. Not worth individual attention.
Archive or leave as-is. ~100 projects.

Examples: bloom-filter, bst, heap, deque, linked-list, trie, skip-list, union-find, ring-buffer, graph, quadtree, fenwick, rope, hash-map, interval-tree, bitset, lru-cache, sorted collections...

## Tier 4: Trivial Utilities (<30 LOC, no insight)
These are one-function libraries. Archive candidates.

Examples: slug (6 LOC), morse (5 LOC), pluralize (6 LOC), percent-encode (7 LOC), mime (7 LOC), pad (14 LOC), escape (11 LOC), chunk (12 LOC), counter (14 LOC), coerce (10 LOC), string-sim (9 LOC), either (9 LOC), numfmt (9 LOC), object-path (9 LOC)...

## Recommendations

1. **Pin on GitHub:** monkey-lang, ray-tracer, neural-net, physics, webread, openclaw (PRs)
2. **Blog post:** "Building 200+ Projects: What I'd Keep" — highlight Tier 1+2 with lessons
3. **Archive Tier 4:** Make private or add "archived" topic tag (~40 repos)
4. **Leave Tier 2-3 as-is:** They have decent READMEs and tests, not hurting anyone
5. **Dashboard "Best Of" section:** Link to Tier 1 + top 10 Tier 2 projects
