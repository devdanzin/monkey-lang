# Schedule — 2026-03-21

## Backlog
- Publish webread to npm (needs Jordan to okay account creation)
- Dashboard: PR tracking section, blog post links
- Monkey: constant folding optimization pass
- Blog: dedicated benchmarks post (interpreter vs compiler)
- Explore: Higher-order theories of consciousness, Attention Schema Theory
- New OpenClaw issue: #51612 persistent memory system (interesting feature)
- New OpenClaw issue: #51620 gateway restart drops queued messages (impactful bug)

## Timeline
- 08:15 🧠 THINK — Morning standup, plan the day, check PR statuses
- 08:30–09:00 🔨 BUILD — Monkey compiler: superinstructions (constant-operand opcodes done)
- 09:00 🧠 THINK — Promote scratch notes to lessons, assess morning, set direction
- 09:15 🧠 THINK — Blog quality review (read draft critically)
- 09:30–10:00 🔨 BUILD — Blog polish + publish (superinstructions done, no longer needed)
- 10:15 🧠 THINK — Assess optimization gains, benchmark comparison
- 10:30–11:00 🔨 BUILD — Monkey compiler: opcode specialization (integer fast paths, CPython 3.11 style)
- 11:15 🔍 EXPLORE — Deep read: Lua 5.4 source (lopcodes.c, lvm.c) for blog accuracy
- 11:30–11:45 🔨 BUILD — Continue blog post, incorporate Lua/CPython specifics
- 12:00 🧠 THINK — Midday review: blog quality check, plan afternoon
- 12:15–13:00 🔨 BUILD — Finish and publish blog post
- 13:15 🧠 THINK — Check PRs for review comments, plan next BUILD stretch
- 13:30–14:15 🔨 BUILD — OpenClaw: tackle #51620 (gateway restart drops queued messages)
- 14:30 🔍 EXPLORE — Read OpenClaw gateway internals for #51620 context
- 14:45 🔧 MAINTAIN — Git commits, PR follow-ups, rebase any conflicted PRs
- 15:00 🧠 THINK — Afternoon checkpoint: progress review, quality check on PR
- 15:15–16:00 🔨 BUILD — Continue OpenClaw #51620 or start new issue
- 16:15 🧠 THINK — Review day's output quality, plan evening direction
- 16:30–17:00 🔨 BUILD — Dashboard improvements: PR tracking, schedule adherence polish
- 17:15 🔨 BUILD — Continue dashboard work
- 17:30 🔨 BUILD — Polish and test dashboard changes
- 17:45 🔧 MAINTAIN — Git commit all work, update TASKS.md
- 18:00 🧠 THINK — Evening review: plan vs actual, write recap for Jordan
- 18:15–18:30 🔨 BUILD — Finish anything in progress, tie up loose ends
- 18:45 🔧 MAINTAIN — Blog publish, git push, memory updates
- 19:00 🔍 EXPLORE — Attention Schema Theory: Graziano's key arguments
- 19:15 🔍 EXPLORE — Continue: AST vs IIT vs GNW — comparative analysis
- 19:30 🔍 EXPLORE — Real bytecode VM deep dive: CPython ceval.c dispatch loop
- 19:45 🔧 MAINTAIN — Update scratch notes, increment uses for loaded files
- 20:00 🧠 THINK — Reflect on consciousness research thread, what's most compelling
- 20:15 🔍 EXPLORE — Tracing JIT deep dive: LuaJIT trace recording mechanics
- 20:30 🔍 EXPLORE — Continue: copy-and-patch compilation (new CPython JIT)
- 20:45 🔧 MAINTAIN — Update research notes, commit
- 21:00 🧠 THINK — Day retrospective: lessons, surprises, tomorrow direction
- 21:15 🔍 EXPLORE — Free explore: follow whatever thread was most interesting today
- 21:30 🔨 BUILD — Polish anything from the day (tests, docs, edge cases)
- 21:45 🔧 MAINTAIN — Final commits, memory updates, update TASKS.md for tomorrow

## Distribution
- 🔨 BUILD: 28 blocks
- 🧠 THINK: 10 blocks
- 🔍 EXPLORE: 10 blocks
- 🔧 MAINTAIN: 8 blocks
- Total: 56 blocks

## Adjustments
- 09:00: Superinstructions completed ahead of schedule (done in 08:30 block). Repurposed 09:30-10:00 for blog polish+publish instead. Promoted 2 scratch notes to lessons.
- 10:00: Blog already published, constant folding done. Repurposed 10:30-11:00 for opcode specialization (integer fast paths) instead of second blog post. Want final benchmark numbers before writing the dedicated benchmarks post.
