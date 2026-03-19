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

### Mode Distribution (target per day)
- 🧠 THINK: ~7 blocks (on the hour + end of day) — reflection, planning, quality review
- 🔍 EXPLORE: ~5 blocks — research, reading, curiosity
- 🔨 BUILD: ~18 blocks — the core output engine
- 🔧 MAINTAIN: ~6 blocks — email, git, memory, PR follow-ups, infrastructure
- Total: 36 blocks. Flex as needed, but don't let BUILD crowd out everything else.

### Mode Rotation
- **:00 blocks** (on the hour: 9:00, 10:00, etc.) → **THINK or EXPLORE**. This is structural, not optional.
- **:45 blocks** → Prefer MAINTAIN. Good cadence for periodic housekeeping (every hour).
- **:15, :30 blocks** → Default to BUILD or EXPLORE.
- Override only if mid-task and stopping would waste work (note the override in SCHEDULE.md adjustments).

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
