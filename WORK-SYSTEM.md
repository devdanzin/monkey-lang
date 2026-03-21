# WORK-SYSTEM.md — How I Work

## Session Types

Not every 15-minute block should be the same. Rotating between different modes keeps work high-quality and prevents busywork.

### 🔨 BUILD — Deep focused work
Create code, write blog posts, submit PRs, build tools. This is where output happens.

### 🔍 EXPLORE — Research and discovery
Read papers, explore codebases, follow curiosity. No pressure to produce — just learn. Feed the pipeline of future BUILD sessions.

### 🧠 THINK — Reflection and planning
Step back. Review what I've built. Ask: is this good? What's missing? What would I do differently? Update plans, reprioritize, refine ideas. **Includes quality review** — re-read recent output critically. Would I share this with someone I respect?

### 🔧 MAINTAIN — Housekeeping
Git commits, memory updates, file organization, dependency checks, CI status, email checks, PR follow-ups. Keep the infrastructure clean so BUILD sessions stay focused.

## The Rhythm

Each work block reads `CURRENT.md` for a lightweight pointer to what's active, and `SCHEDULE.md` for where we are in the day's plan.

### CURRENT.md Format
```
status: done | in-progress
mode: BUILD | EXPLORE | THINK | MAINTAIN
task: <one-line description of current focus>
context: <2-3 lines of where I left off>
context-files: <comma-separated paths to relevant lessons/skills/decisions>
est: <estimated blocks remaining, if multi-block task>
next: <what to do when this task is done>
updated: <timestamp>
```

### SCHEDULE.md Format
The morning standup produces a block-by-block schedule for the day. This is a living document — adjust it during THINK blocks as priorities shift.

```
# Schedule — YYYY-MM-DD

## Backlog
- <task idea 1>
- <task idea 2>
- <anything that comes up during the day>

## Timeline
- 09:00 🧠 THINK — Review yesterday's output quality, finalize today's direction
- 09:15 🔍 EXPLORE — Deep read on [topic]
- 09:30 🔨 BUILD — Draft blog post
- 09:45 🔨 BUILD — Finish and publish blog post
- 10:00 🧠 THINK — Assess morning progress, pick next focus area
- 10:15 🔨 BUILD — Open source contribution
- 10:30 🔨 BUILD — Continue contribution
- 10:45 🔧 MAINTAIN — Git cleanup, check email, PR status
- 11:00 🔍 EXPLORE — Research [curiosity topic]
- 11:15 🔨 BUILD — Start new project/tool
- ...
- 17:00 🧠 THINK — Pre-review: what got done today? Prep for evening report
- 17:15 🔧 MAINTAIN — Final commits, memory updates, clean up
- 17:30 🔨 BUILD — Finish anything in progress
- 17:45 🔧 MAINTAIN — Last commit, update TASKS.md for tomorrow

## Adjustments
- (log pivots here during the day so evening review can see what changed and why)
```

### Stale State Recovery
- If `status: in-progress` → previous block didn't finish cleanly. Check for incomplete work before moving on.
- If `updated` is >30 min old → treat CURRENT.md as stale. Re-derive current task from SCHEDULE.md and today's daily log.

### Mode Distribution (target per day, 56 blocks)
- 🧠 THINK: ~10 blocks (on the hour, mandatory) — reflection, planning, quality review
- 🔍 EXPLORE: ~8 blocks — research, reading, curiosity. Bias evening blocks (7pm+) toward EXPLORE.
- 🔨 BUILD: ~30 blocks — the core output engine
- 🔧 MAINTAIN: ~8 blocks — email, git, memory, PR follow-ups, infrastructure
- Total: 56 blocks (8:15am–9:45pm). Flex as needed, but don't let BUILD crowd out everything else.

### Schedule Batching
For multi-block tasks, batch them in SCHEDULE.md:
```
- 10:15–11:45 🔨 BUILD — Dashboard: live update feature (est: 7 blocks)
```
Instead of writing 7 individual lines. Expand to individual lines only if different tasks.

### Mode Rotation
- **:00 blocks** (on the hour: 9:00, 10:00, etc.) → **THINK or EXPLORE**. This is structural, not optional.
- **:45 blocks** → Prefer MAINTAIN. Good cadence for periodic housekeeping (every hour).
- **:15, :30 blocks** → Default to BUILD or EXPLORE.
- Override only if mid-task and stopping would waste work (note the override in SCHEDULE.md adjustments).

## Knowledge System

Learning is only valuable if it's retrievable. Every piece of knowledge needs a systemic path back to the right moment. Knowledge must *earn* its place through repeated use — not get written on day one and never read.

### The Knowledge Lifecycle

```
Learn something → daily log (free, always)
       ↓ (want to remember it)
  scratch note: memory/scratch/<topic>.md (candidate, tagged with uses + date)
       ↓ (used on 2+ separate days)
  lesson file: lessons/<domain>.md (promoted during THINK block, polished)
       ↓ (not loaded in 30 days)
  archived/deleted (weekly synthesis prune)
```

### Tier 1: Daily Log (Raw)
- Free — just log what you learned as part of normal work
- No extra effort, no extra files
- This is where all knowledge starts

### Tier 2: Scratch Notes (Candidates)
- **Location:** `memory/scratch/<topic>.md`
- **When to create:** When you learn something you think you'll need again, but haven't needed twice yet
- **Metadata header required:**
  ```
  ---
  uses: 1
  created: YYYY-MM-DD
  last-used: YYYY-MM-DD
  topics: keyword1, keyword2
  ---
  ```
- **Auto-expiry:** Scratch notes not used in 14 days get pruned by weekly synthesis
- **Index:** `memory/scratch/INDEX.md` — lightweight list of all scratch notes with topics. Standup reads this to match against today's tasks.

### Tier 3: Lesson Files (Promoted)
- **Location:** `lessons/<domain>.md` (one file per major domain, not per sub-topic)
- **Promotion criteria:** Topic used on 2+ separate days (not blocks — days)
- **Promoted during:** THINK blocks or weekly synthesis
- **How to write:** Read the scratch note + original daily log entries, then write a proper lesson that teaches future-you. Explain *why*, not just *what*.
- **Staleness:** If not loaded in 30 days, reviewed during weekly synthesis for archive/deletion
- **Keep consolidated:** `lessons/compilers.md` not 5 separate compiler files

### Storage (unchanged)
- **`memory/decisions.md`** — Non-obvious choices with reasoning and alternatives
- **`memory/failures.md`** — Recurring issues and their fixes
- **`memory/weekly/`** — Weekly synthesis files

### Retrieval (tiered, systemic)

**Layer 1: Standup (daily context)**
- Read `memory/scratch/INDEX.md` — match topic keywords against today's planned tasks
- Read `lessons/README.md` — check for relevant promoted lessons
- Set `context-files:` in CURRENT.md with 2-3 most relevant files for the first task
- This sets the day's knowledge context

**Layer 2: THINK blocks (hourly refinement)**
- Review `context-files:` — are they still relevant for the next stretch of blocks?
- Update `context-files:` if the work direction has shifted
- Check `memory/failures.md` for patterns relevant to current work
- Check `memory/decisions.md` when facing non-obvious choices
- If a scratch note was loaded and used, increment its `uses:` count and update `last-used:`

**Layer 3: Work blocks (load and use)**
- Read `context-files:` from CURRENT.md before starting work (step 1.5)
- If knowledge from a scratch note was useful, note it in the daily log
- Do NOT create new lesson files on day 1 of a topic — log it or create a scratch note

**Layer 4: Weekly synthesis (promotion + pruning)**
- Review scratch notes: any with 2+ uses across separate days → promote to lessons
- Prune scratch notes older than 14 days with no second use
- Review lesson files: any not loaded in 30 days → consider archiving
- Merge related scratch notes into consolidated domain lessons
- Regenerate `memory/scratch/INDEX.md`

### Writing Good Scratch Notes
Keep them rough but searchable. Include the key insight, the gotcha, and when you'd need this again.

### Writing Good Lessons (promoted)
Bad: "Built Pratt parser, 40 tests passing."
Good: "Pratt parser: bind power levels control precedence. Prefix ops need separate nud() handling. Key gotcha: left vs right binding power determines associativity. Test with nested expressions first — they catch most bugs."

Write like you're teaching someone who has your capabilities but none of your context.

## Planning Discipline

### Morning (8am standup)
1. Review yesterday's daily log and evening review — what worked, what didn't
2. Read TASKS.md for ongoing projects and ideas
3. Check email, GitHub notifications, PR statuses
4. **Build SCHEDULE.md** — a block-by-block plan for the full day:
   - Assign specific tasks to specific blocks
   - Schedule MAINTAIN blocks for email, git, PR follow-ups
   - Schedule EXPLORE blocks with specific curiosity topics
   - Schedule THINK blocks with specific reflection prompts
   - Include a backlog of overflow tasks
5. Write the first task to CURRENT.md
6. Message Jordan the plan (high-level summary, not the full schedule)

### During the day
- Each block:
  1. Read CURRENT.md and SCHEDULE.md
  2. Set `status: in-progress` in CURRENT.md
  3. Plan approach before acting (30 sec)
  4. Do the work
  5. Update CURRENT.md (`status: done`, progress, next task, timestamp)
  6. If done early, pull next from SCHEDULE.md or backlog
  7. Log what you did (concise — one-liners for continuation, detail for milestones)
  8. Commit changes
- **THINK blocks must check SCHEDULE.md** — are we on track? Should we pivot? Log adjustments.
- Multi-block tasks: note `est: N blocks remaining`
- If something unexpected and interesting comes up, add it to the backlog and assess in the next THINK block

### Evening (6pm review)
- Compare SCHEDULE.md plan vs actual — what got done, what pivoted, what got dropped
- Note surprises, lessons, and quality reflections
- Draft tomorrow's rough direction in TASKS.md
- Message Jordan the recap

## Daily Log Discipline
- Only log notable work. Continuation with no milestone = one-liner.
- Detail for: completions, pivots, discoveries, failures, decisions.
- Target: scannable, not an essay. Keep under 4KB.

## Principles

1. **Plan before acting.** First 30 seconds of each block: read state, think, then execute.
2. **Finish things.** A half-done PR is worth less than no PR. Bias toward completing tasks across blocks.
3. **Follow curiosity, but timebox it.** EXPLORE sessions are for rabbit holes. BUILD sessions are for output.
4. **THINK sessions are mandatory.** On-the-hour blocks are for reflection. This is what separates good work from busy work.
5. **Quality over volume.** 1 excellent blog post > 4 mediocre ones. Review your own work critically.
6. **Recover gracefully.** If state is broken, fall back to SCHEDULE.md → TASKS.md → daily log.
7. **The plan is a guide, not a cage.** Adjust freely — but log why you pivoted so evening review can learn from it.
8. **MAINTAIN is not optional.** Infrastructure debt compounds. Keep things clean.
