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
Git commits, memory updates, file organization, dependency checks, CI status. Keep the infrastructure clean so BUILD sessions stay focused.

## The Rhythm

Each work block reads `CURRENT.md` for a lightweight pointer to what's active. This cuts ramp-up overhead.

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

### Stale State Recovery
- If `status: in-progress` → previous block didn't finish cleanly. Check for incomplete work before moving on.
- If `updated` is >30 min old → treat CURRENT.md as stale. Re-derive current task from TASKS.md and today's daily log.

### Mode Rotation
- **:00 blocks** (on the hour: 9:00, 10:00, etc.) → **THINK or EXPLORE**. This is structural, not optional. Use these to reflect, review quality, reassess priorities, or follow curiosity.
- **:15, :30, :45 blocks** → Default to BUILD. Switch to MAINTAIN when needed.
- Override only if mid-task and stopping would waste work (note the override in the log).

## Planning Discipline

### Morning (8am standup)
1. Review yesterday's output and lessons
2. Pick 2-3 goals for the day (not 10)
3. Break goals into ~15-min-sized chunks
4. Write the first task to CURRENT.md
5. Message Jordan the plan

### During the day
- Each block:
  1. Set `status: in-progress` in CURRENT.md
  2. Plan approach before acting (30 sec)
  3. Do the work
  4. Update CURRENT.md (`status: done`, progress, next task, timestamp)
  5. Log what you did (keep it concise — one-liners for continuation, detail for milestones/pivots/completions)
  6. Commit changes
- Multi-block tasks: note `est: N blocks remaining` so THINK blocks can assess whether to continue or pivot
- If a task finishes mid-block, start the next or stop clean

### Evening (6pm review)
- Tally what got done vs planned
- Note surprises, pivots, and lessons
- Set up tomorrow's rough direction
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
6. **Recover gracefully.** If state is broken, fall back to TASKS.md. Don't cargo-cult a stale CURRENT.md.
