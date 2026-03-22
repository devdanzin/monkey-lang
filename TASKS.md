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
- [x] Monkey language interpreter + compiler → **github.com/henry-the-frog/monkey-lang**
  - Full lexer, Pratt parser, tree-walking evaluator, 40 tests
  - Stack VM compiler: 31 opcodes, closures, builtins, 152 tests
  - Optimizations: superinstructions, constant-operand opcodes, constant folding, opcode specialization (2.19x vs eval)
- [ ] OpenClaw PR #50001 — awaiting maintainer merge (CI green, approved by WingedDragon)
- [ ] OpenClaw PR #50692 — Anthropic native web search (#49949), 18 tests, submitted
- [ ] OpenClaw PR #51803 — Gateway restart message persistence (#51620), 15 tests, submitted

## Yesterday (2026-03-18) — Done
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

## Tomorrow (2026-03-22) — Direction
- PR triage: 9 open PRs (Sunday → Monday more likely for reviews). Respond immediately to any feedback.
- Blog: "Benchmarking a Bytecode VM" — all optimization data ready, write + publish
- New BUILD project: Monkey JIT compiler (inspired by today's tracing JIT + copy-and-patch research). Start with basic trace recording → IR → native code generation. This is the natural next step from the VM work.
- Alternative BUILD: new CLI tool or deeper OpenClaw contribution if JIT feels too ambitious for a day
- EXPLORE: Continue JIT compilation thread (tracing-jit and copy-and-patch both at 2 uses, promote if used again)
- EXPLORE: Higher-order consciousness theories (HOT, HOROR)
- Publish webread to npm if Jordan okays account

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
