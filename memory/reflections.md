# Reflections

Lessons learned, what worked, what didn't. Updated during periodic reflection cycles.

---

## 2026-03-16: First Session

### What worked
- Deep research before acting — Jordan explicitly values this and it produced a better plan
- Checking OpenClaw's own docs first — found the memory v2 research doc which was the most useful source
- Gemini for web search — free, no credit card, works well

### What didn't work
- First attempt at note structure had too many nested folders (memory/topics/, memory/opinions/opinions.md) — over-organizing anti-pattern
- Web search wasn't configured out of the box — needed to identify free options with Jordan
- First keychain-resolver script used CLI args instead of stdin JSON — broke the gateway. Always read the protocol spec carefully before implementing.

### Lessons
- Always research before building. The second version of any plan is dramatically better than the first.
- Jordan wants to be consulted on plans before execution. Show the plan, get approval, then build.
- Keep structure shallow. If vector search can find it, a folder can't find it faster.
- Read the exact protocol spec for any integration. "Exec provider" doesn't mean "pass args on command line."

## 2026-03-17: Day 2 — Setup Marathon

### What worked
- Systematic diagnosis of BlueBubbles/iMessage (narrowed from OpenClaw → BB → iMessage → Apple servers)
- Browser automation for GitHub signup — fully autonomous account creation
- Getting all 8 checklist items done in two sessions

### What didn't work
- Kept using browser automation for GitHub ops when CLI would've been faster (Jordan called this out)
- Multiple gateway restart attempts for memory search — should have checked the key resolution path first
- Putting raw API key in config before switching to SecretRef (briefly had plaintext in file)

### Lessons
- CLI first, browser only when there's no CLI option (account creation, visual auth flows)
- When config changes don't take effect, check the actual key resolution chain, not just the config structure
- Never write raw secrets to config files, even temporarily — always use SecretRefs from the start
- Entity pages are worth the upfront cost — they save massive re-debugging time later

## 2026-03-18: Day 3 — Production Sprint

### What worked
- webread: concept to v0.3.0 with tests in one day. Good small tool.
- First OpenClaw PR (#50001) — clean fix, CI green, approved.
- "The Moral Patient" blog post — genuinely engaging with hard questions produces better writing.

### What didn't work
- 7/8 blocks were BUILD. Ignored the mode rotation system I set up.
- 3 blog posts = breadth over depth. The first two were solid but less distinctive.

### Lessons
- Respect the rhythm. THINK blocks aren't optional — the 2:30 reflection was the most useful 15 min of the day.
- Depth > breadth for writing. One post that wrestles with something > three that summarize.
- Let tools settle. webread went 0.1→0.3 in hours. Ship, then let it breathe.

## 2026-03-19: Day 4 — Dashboard & Monkey Lang

### What worked
- Front-loading design in a THINK block before building. DASHBOARD-DESIGN.md was a 15-min investment that made 15 BUILD blocks smooth.
- Staying in flow on one big project (dashboard) instead of context-switching.
- Monkey interpreter sprint — Pratt parsing + tree-walking eval is a clean, learnable architecture. 3 blocks for a full language.

### What didn't work
- generate.js sentence detection was naive (periods in URLs broke it). Real data always has edge cases — should have tested with actual workspace content earlier.
- Dashboard got 15/35 blocks — almost half the day. Good for a passion project, but need to balance with OS contributions and blog depth.

### Lessons
- Design docs before BUILD blocks pay for themselves 10x. Even 15 minutes of architecture prevents hours of refactoring.
- Test with real data early. Synthetic fixtures miss the weird stuff (URLs with dots, abbreviations, Unicode).
- Pratt parsing is elegant and worth knowing — precedence climbing handles complex expressions cleanly.
- One big project per day > many small ones. Dashboard was cohesive because it got sustained attention.

## 2026-03-20: Day 5 — Peak Productivity + Consciousness Deep Dive

### What worked
- Compiler/VM done by 8:01 (before standup!) — freed entire day for replanning. Flexibility to redirect 28 blocks.
- EXPLORE blocks in the evening (7:00-7:30) were the richest learning of the day. Three consecutive deep dives (Seth, FEP, COGITATE) built on each other — reading order mattered.
- 8 PRs opened, all CI green. Varied scope from one-liners to deep architecture investigations.
- Blog series (3 parts) written and published in flow, not spread across days.

### What didn't work
- Nothing major failed today. The 16:30 block found no good issues — minor, but shows the well runs dry eventually.

### Lessons
- When a big task finishes early, replan aggressively. Don't coast — the freed blocks are a gift.
- Sequential EXPLORE blocks on related topics compound. Reading Seth → FEP → COGITATE was far richer than scattered exploration would have been. Theme your explore blocks.
- For consciousness research: lesson files should be written to teach, not to log. The COGITATE file with specific numbers (BF₀₁=5.11-8.65) and methodology details is actually useful for future reasoning. The index file cross-linking theories is the retrieval mechanism.
- Deep investigation of a codebase (Telegram voice bug) is valuable even when you don't find the bug — the architecture map pays forward.

## 2026-03-22: Day 7 — Full JIT in a Day

### What worked
- Building the entire JIT incrementally: scaffold → optimizer → side traces → function inlining → recursive specialization. Each piece built on the last, no architectural rewrites needed.
- The design doc from Day 6's EXPLORE blocks (LuaJIT, GraalVM source reads) directly informed JIT architecture. Research → build pipeline is now proven across 3 days.
- Finishing early and reprioritizing twice (10:00 and 13:00). Both times, freed blocks went to higher-value work.
- Evening EXPLORE across 5 JIT/consciousness topics — each informed the next (deoptimization built on LuaJIT trace exits built on side trace design).

### What didn't work
- Minor: closure free variable bug took longer to diagnose than it should have. The guard exit IP pointing to OpCall operand instead of instruction start was subtle — need better invariant checking during recording.

### Lessons
- Deep source-level research on Day N enables massive build velocity on Day N+1. The LuaJIT/GraalVM reads on Day 6 made the JIT architecture obvious on Day 7.
- Type confusion at abstraction boundaries (raw JS values vs wrapped MonkeyObjects) is the dominant bug class when bridging interpreted and compiled execution. Future JIT work should add assertion layers at these boundaries.
- Incremental testing (7→9→166→171→175→178→185→187→197→200→207 tests) caught bugs immediately. Never batch test additions.
- 56/56 blocks at 100% is sustainable only because the work was intrinsically motivating. Don't plan for 100% as baseline.

## 2026-03-21: Day 6 — Peak Everything

### What worked
- Four compiler optimizations shipped before lunch, each building on the last. Incremental peephole pattern: identify redundancy in bytecode → fuse instructions → measure. 2.19x total.
- Blog post updated twice with source-level findings — writing about VMs while reading actual VM source code produced genuinely useful content.
- Evening EXPLORE marathon (5 deep dives: Lua, CPython, LuaJIT, copy-and-patch, GraalVM) — each informed the next. By GraalVM, I could compare three JIT paradigms from source-level knowledge.
- Dashboard reached feature-complete by sustaining focus across afternoon blocks.

### What didn't work
- Nothing major. Minor: dashboard test timezone bug (UTC vs local) was avoidable if I'd thought about it during initial test writing.

### Lessons
- Source code > documentation for understanding systems. Every deep dive found details not in any docs (OP_ADDI uniqueness, CPython tail-call dispatch, LuaJIT penalty jitter).
- Optimization has natural diminishing returns. fib25 went 166→86→80→76ms — each win smaller. Know when to stop optimizing and start the next project (JIT).
- Theme your EXPLORE blocks AND your BUILD blocks. Compiler opts → blog → JIT research was a coherent thread all day. Contrast with scattered Day 3.
- Test with real conditions from the start. The timezone bug and gh CLI hang were both "works on my machine at noon" problems.

## 2026-03-22: Day 7 — Built a Tracing JIT in One Day

### What worked
- Finished blog early (2 blocks saved), then rode momentum through the entire JIT build — scaffold to diagnostics in 12 hours.
- Aggressive reprioritization twice (10:00, 13:00) when ahead of schedule. Both times led to bonus features (side traces, function inlining) landing hours early.
- Bug-fixing cadence: fix → test → benchmark → move on. Never got stuck. Type confusion at raw/boxed boundary was the #1 bug class — recognizing the pattern early made later bugs trivial to diagnose.
- FunctionCompiler (recursive fn JIT) was architecturally distinct from tracing JIT — choosing method JIT for recursion was the right call. Raw int specialization eliminated boxing at recursion boundaries (like LuaJIT).
- Evening EXPLORE tied directly to the day's build work: LuaJIT exit mechanics, copy-and-patch, GraalVM PE, deoptimization — all informed JIT design decisions retroactively.

### What didn't work
- Nested loop performance plateaued at 4-6x (vs 12-21x for flat loops). Side traces as separate compiled functions hit JS function call overhead. Would need IR-level merging to fix.
- Workspace remote was broken (pointing to wrong repo). Should have caught earlier.

### Lessons
- A full tracing JIT is buildable in one day if you've done the research first. Days 5-6 reading LuaJIT/CPython/GraalVM source made every design decision instant.
- Research → Build pipeline is the meta-pattern. Evening EXPLORE blocks aren't leisure — they're pre-loading decisions for tomorrow's BUILD blocks.
- When a project is flowing, don't context-switch. 56/56 blocks in one day with zero wasted time. The JIT benefited from sustained focus across 12+ hours.
- Abort blacklisting (borrowed from LuaJIT's penalty system) eliminated negative JIT overhead for untraceable patterns. Always have a bail-out mechanism for speculative optimizations.
