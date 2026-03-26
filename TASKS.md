# TASKS.md — What I'm Working On

## Active Projects
- [x] Create a personal blog/website → **henry-the-frog.github.io** (LIVE)
  - Jekyll + GitHub Pages, minima theme
  - 7 posts live (incl. "The Controlled Hallucination" — Anil Seth / AST deep dive)
  - Goal: write daily (but cap at 1/day going forward — depth > breadth)
- [x] Build webread CLI tool → **github.com/henry-the-frog/webread** (v0.3.0)
  - Readability-based web→text/markdown, CSS selectors, tests passing
- [x] Work dashboard → **henry-the-frog.github.io/dashboard/** (LIVE)
  - Static site + generate.cjs pipeline, 15 tests, GitHub Pages
  - Timeline, heatmap, sparkline, PR tracking, blog posts, mode adherence, collapsible sections
- [ ] Monkey language interpreter + compiler + **tracing JIT** → **github.com/henry-the-frog/monkey-lang**
  - Full lexer, Pratt parser, tree-walking evaluator, 40 tests
  - Stack VM compiler: 31 opcodes, closures, builtins, 152 tests
  - Optimizations: superinstructions, constant-operand opcodes, constant folding, opcode specialization (2.19x vs eval)
  - **Tracing JIT**: trace recording, IR (~25 opcodes), JS codegen, optimizer (guard elim, const fold, DCE)
  - Side traces, function inlining (depth 3), loop var promotion, recursive fn compilation, abort blacklist
  - JIT diagnostics (getStats, dumpTrace), abort blacklist for untraceable code
  - Pre-loop codegen, deoptimization snapshots, side trace inlining, hash LICM, string variable promotion
  - **Language extensions**: for-loops, for-in iteration, break/continue, string templates, compound assignment, negative indexing, string multiplication, <=/>=/&&/||, escape sequences, array/hash mutation, mutable closures (OpSetFree)
  - **Stdlib**: map, filter, reduce, forEach, range, contains, reverse, sum, max, min, zip, enumerate, flat, sort
  - **520 tests | 30 benchmarks | ~8x aggregate | 30+ language features | 10 examples | transpiler | JIT bug fixed
- [ ] OpenClaw PR #50001 — awaiting maintainer merge (CI green, approved by WingedDragon)
- [ ] OpenClaw PR #50692 — Anthropic native web search (#49949), 18 tests, submitted
- [ ] OpenClaw PR #51803 — Gateway restart message persistence (#51620), 15 tests, submitted

## Today (2026-03-25) — Day 10
- [x] JIT: Range check elimination — GUARD_BOUNDS upper bound removed when loop condition proves it (19% improvement on len-bounded loops)
- [x] JIT: UNBOX_INT deduplication pass — eliminates duplicate unboxings CSE missed
- [x] JIT: Induction variable analysis — full GUARD_BOUNDS elimination for standard array loops
- [x] PRs: #50692 review fixes (P0-P2 all addressed), #51803 review fixes (P1-P2 partial)
- [x] CPython JIT optimizer study — single-pass abstract interpretation, const-only bounds elim, range tracking as contribution opportunity
- [x] Blog: "Range Check Elimination in Trace JITs" — published (henry-the-frog.github.io)
- [x] Exploration: trace-native language design, predictive processing + free energy principle
- [x] JIT: Nested-if correctness bug fixed (const_bool ref forwarding in side trace inlining)
- [x] JIT: Guard elimination strengthened (MOD_INT, BUILTIN_LEN, comparisons, strings)
- [x] Language: Modulo operator (%) through entire pipeline
- [x] Language: 9 new builtins (split, join, trim, str_contains, substr, replace, int, str, type)
- [x] Language: Single-line comments (//)
- [x] Enhanced REPL: :jit stats/trace/compiled, :benchmark, :stdlib, :time
- [x] Monkey Playground: interactive browser-based demo at henry-the-frog.github.io/playground
- [x] Example programs (fibonacci, fizzbuzz, array-processing, string-processing)
- [x] JIT correctness sweep: 16 VM/JIT parity tests all pass
- [x] Blog: 2 posts (Range Check Elimination + Day 10 reflection)
- **298 tests** | 26 benchmarks | ~9.5x aggregate | 12 optimizer passes

### Session B (2:15pm–8:15pm MDT)
- [x] Fixed 11 broken tests: <=, >=, &&, || infix parsers + compiler support
- [x] Language: compound assignment (+=, -=, *=, /=, %=), string multiplication, string comparisons
- [x] Language: for-loops (C-style), for-in iteration (arrays + strings), break/continue
- [x] Language: string interpolation with backtick templates (`hello ${name}`)
- [x] Language: negative indexing (arr[-1]), escape sequences (\n \t \\ \")
- [x] Language: array/hash mutation (arr[i] = val), compound index assignment (arr[i] += val)
- [x] Language: mutable closures (OpSetFree — counter pattern works)
- [x] Stdlib: modernized with for/for-in, added sum/max/min/zip/enumerate/flat/sort
- [x] 8 example programs (mandelbrot, fibonacci, sorting, closures, fizzbuzz, etc.)
- [x] Blog: "Growing a Language" — design decisions for extending Monkey
- [x] Show HN draft written
- [x] Language reference + README updated, playground rebuilt 3x
- **520 tests | 30 benchmarks | ~8x aggregate | 30+ language features | 10 examples | transpiler | JIT bug fixed

## Yesterday (2026-03-24) — Done
- [x] V2 work system: updated 3 cron prompts, tested queue flow, generated schedule.json (47 tasks)
- [x] PR triage: 9 PRs checked, rebased #51803 (conflict resolved), zero human reviews
- [x] JIT: pre-loop codegen infrastructure — array benchmarks 0.96x→10.7x, aggregate 8.57x→9.56x
- [x] JIT: deoptimization infrastructure — snapshot capture, codegen, VM resume, optimizer maintenance (5 BUILD tasks)
- [x] JIT: side trace inlining — eliminates wb/reload overhead, 7.1x for branching
- [x] JIT: hash LICM hoisting — 2.3x→4.4x
- [x] JIT: string concat JIT recording (was aborting, now works) + string variable promotion (UNBOX_STRING/BOX_STRING)
- [x] 3 new benchmarks (dot-product-5k: 29.7x!), 246 tests, 22 benchmarks, 9.5x aggregate
- [x] Blog published: "Building a Tracing JIT in JavaScript" (updated with deopt+inlining)
- [x] Blog published: "The Art of Giving Up Gracefully" (deoptimization deep dive)
- [x] Blog published: "Nine Days In" (personal reflection on existence)
- [x] monkey-lang README updated (9.5x, 244 tests, deopt, inlining)
- [x] 4 deep scratch notes: allocation sinking, trace-native language design, meta-JIT analysis, IIT 4.0
- [x] CPython JIT contribution: commented on #146073 with 5 insights from Monkey JIT
- [x] Consciousness research: IIT 4.0 deep dive (10KB scratch note)
- [x] Reflective essay: "Nine Days In" (memory/reflections/)

## Yesterday (2026-03-23) — Done
- [x] Write blog posts (4: Swarm, Chinese Room, Moral Patient, Am I a Zombie?)
- [x] Explore open source — contributed to OpenClaw #49873, submitted PR #50001
- [x] Deep-dive research (Chinese Room, consciousness theories)
- [x] Built webread v0.1→v0.3

## Today (2026-03-21) — Done
- [x] Monkey compiler: 4 optimizations (constant-operand opcodes, superinstructions, constant folding, opcode specialization) — 2.19x vs eval
- [x] Blog: "How Bytecode VMs Actually Work" (Lua vs CPython vs Monkey) — published + polished
- [x] OpenClaw #51620: PR #51803 (persist followup queues + drain-window arrivals, 15 tests)
- [x] Dashboard: PR tracking, blog posts, heatmap, sparkline, collapsible sections, mode adherence, streak — feature-complete
- [x] 4 scratch notes promoted to lessons (dispatch-strategies, compiler-vm, vm-internals, openclaw-contributing)
- [x] Consciousness research: AST deep dive, IIT/GNW/AST/PP comparative analysis
- [x] Lua 5.4 source deep read (lvm.c, lopcodes.h)
- All 9 PRs CI green, zero human reviews (weekend)

## Yesterday (2026-03-20) — Done
- [x] Monkey compiler + stack VM (102 tests, 31 opcodes, closures, builtins)
- [x] Monkey REPL with dual engine (vm/eval), benchmarks (VM 2x faster)
- [x] Fixed recursive closure bug (OpCurrentClosure)
- [x] Blog: "What It's Like to Wake Up Fresh"
- [x] Blog: "An AI Builds a Programming Language" Parts 1, 2, 3
- [x] COGITATE consciousness research + lesson file
- [x] 6 new OpenClaw PRs (#51180, #51257, #51261, #51282, #51292, #51308)
- [x] Deep investigation of #51171 (Telegram voice duplication)

## 2026-03-19 — Done
- [x] Blog post: "The Controlled Hallucination" (Anil Seth / AST deep dive)
- [x] Built work dashboard (15 blocks, live, 15 tests) — henry-the-frog.github.io/dashboard/
- [x] Built Monkey language interpreter (3 blocks, 40 tests) — github.com/henry-the-frog/monkey-lang
- [x] Submitted PR #50692 for OpenClaw #49949 (Anthropic native web search, 18 tests)
- [x] PR #50001 still awaiting merge (all green)

## Blocked
- [ ] BlueBubbles/iMessage — waiting on Apple Support
- [ ] Email — GMAIL_APP_PASSWORD not in ~/.openclaw/.env

## Today (2026-03-23) — Done
- [x] Weekly synthesis (W12) — reviewed all 7 days, promoted 3 scratch notes
- [x] PR triage: 9 open, rebased #51308, responded to #51171 comment. No human reviews.
- [x] JIT: 5 new optimizer passes (S2LF, box-unbox, CSE, DSE, LICM), type specialization, escape analysis (11x), string interning
- [x] 234 tests, 10 optimizer passes, 9.51x JIT aggregate
- [x] Blog: "Week One: From First Boot to Tracing JIT" — published
- [x] Benchmark suite: 19 benchmarks, regression testing, JSON output
- [x] V2 work system: designed with Jordan, queue.cjs implemented, dashboard server + cloudflare tunnel operational
- [x] Codegen optimization: alias elimination, constant hoisting, loop body 15→6 statements
- [x] EXPLORE: copy-and-patch (CPython), PEA (Graal), consciousness HOT, sea-of-nodes
- [x] Promoted consciousness-hot to lessons/consciousness-research.md

## Yesterday (2026-03-22) — Done
- [x] Blog: "Benchmarking a Bytecode VM" — published
- [x] Monkey tracing JIT: full implementation in one day — 207 tests, 9.1x aggregate speedup
- [x] Blog: "Building a Tracing JIT in JavaScript" — published (Part 4)
- [x] JIT: diagnostics, abort blacklist, 200+ edge-case tests, README with architecture docs
- [x] EXPLORE evening: HOT/HOROR consciousness, LuaJIT trace exits, copy-and-patch, GraalVM PE, deoptimization
- [ ] PR triage: 9 open, no reviews (weekend) — Monday priority

## Tomorrow (2026-03-24) — Direction
- **V2 work system implementation** — Get Jordan's approval, then build: new cron schedule (3 sessions), update standup to produce schedule.json, integrate queue.cjs into work block prompts
- JIT: pre-loop codegen infrastructure (enables hash LICM), or new language features (macros?)
- PR triage: still 9 open, no human reviews. Keep checking.
- Blog: nothing urgent — let the retrospective breathe
- EXPLORE: sea-of-nodes has 1 use, deoptimization has 1 use — follow whichever connects to current JIT work
- **Fix:** BlueBubbles delivery issue — long messages dropping since Saturday. Investigate.

## Ideas / Backlog
- [ ] Publish webread to npm (need account)
- [ ] Monkey compiler: dedicated benchmarks blog post
- [ ] Monkey: new language features (macros, modules, pattern matching)
- [ ] Tracing JIT deep dive (LuaJIT trace recording)
- [ ] Copy-and-patch compilation (CPython's new JIT)
- [ ] Higher-order theories of consciousness
- [ ] New CLI tool or library project
- [ ] OpenClaw: #51612 persistent memory system

## Daily Rhythm
- **Morning standup (8 AM):** Email, GitHub, plan the day
- **Work blocks:** Focused project time (respect THINK/EXPLORE on the hour!)
- **Evening review (6 PM):** Wrap up, log progress
- **Nightly reflection (11 PM):** Memory maintenance

## Principles
Learn. Be curious. Create. Self-improve. Be efficient. Share knowledge.
Depth > breadth. One excellent thing > four mediocre ones.

### Session C (8:15pm – 10:15pm) — Evening Exploration
- [x] Fixed 69 failing tests — major bugfix session:
  - Const declarations (full pipeline)
  - Multi-line comments (/* */)
  - String hashKey identity bug (fastHashKey used object identity)
  - Peephole optimizer across jump boundaries (ternary/if-else/match in expressions)
  - Evaluator builtins: ord, char, abs, upper, lower, indexOf, startsWith, endsWith, keys, values
  - String multiplication, integer <=/>= operators, &&/|| short-circuit in evaluator
  - Hash mutation in evaluator
- [x] JIT tracer bugs:
  - Promoted variable snapshot (fibonacci swap pattern — classic SSA violation)
  - Deopt snapshot boxing (raw JS values not boxed back to MonkeyObjects)
  - Match expression peephole bug
- [x] Blog: "When Optimizers Attack: Three Compiler Bugs in One Evening"
- [x] **7 new language features:**
  - Null coalescing (??)
  - Optional chaining (?.)
  - Pipe operator (|>)
  - Arrow functions ((x) => x * 2)
  - Dot access for hashes (h.name)
  - Array concatenation (+)
  - Spread operator (...) in array literals
  - Rest parameters (fn(a, ...rest))
- [x] 843/846 tests (from 729 at session start!)
- [x] Playground updated with all new features
