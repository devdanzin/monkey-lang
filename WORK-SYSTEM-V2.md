# WORK-SYSTEM-V2.md — Proposed New Work System

## Overview

A continuous work session that processes an ordered task queue. No fixed timers between tasks — the agent chains tasks back-to-back with zero dead time. Modes are enforced by queue position, not agent willpower.

---

## Architecture

### Daily Schedule (cron jobs)
| Time | Job | Type | Purpose |
|------|-----|------|---------|
| 8:00am | Morning standup | Isolated | Build SCHEDULE.md queue, message Jordan |
| 8:15am | Work Session A | Isolated, 6hr timeout | Process queue until 2:15pm |
| 2:15pm | Work Session B | Isolated, 6hr timeout | Continue queue until 8:15pm |
| 8:15pm | Work Session C | Isolated, 2hr timeout | Evening queue until 10:15pm |
| 10:15pm | Evening review | Isolated | Summarize day, message Jordan |
| 11:00pm | Nightly reflection | Isolated | Memory maintenance |
| Sunday 9pm | Weekly synthesis | Isolated | Knowledge promotion/pruning |

### Why Three Work Sessions?
- Prevents unbounded context growth (fresh start every 6 hours)
- Automatic crash recovery (if Session A dies, Session B picks up)
- Each session reads all state from files — no continuity loss
- Pre-compaction memory flush saves context before any compaction within a session

---

## Task Modes

### 🧠 THINK — Reflect and ponder
- Reflect on what you just built. Is it good? What's missing?
- Ponder new ideas, connections, questions
- Review quality of recent work critically
- Consider whether the current direction is right
- **May modify the queue** (reorder, add, remove tasks)
- **NO maintenance.** No git, no email, no file cleanup.
- **NO planning.** Don't break down tasks — that's PLAN's job.

### 📋 PLAN — Plan and prepare
- Read the goal assigned to this PLAN task
- Load relevant context: scratch notes, lessons, code, failures log
- Break down the goal into concrete BUILD subtasks
- **Fill in the placeholder BUILD slots** in the queue with specific tasks
- Add or remove BUILD slots if the goal is bigger/simpler than estimated
- Set `context-files:` in CURRENT.md for upcoming BUILD tasks
- Log any queue changes in Adjustments section
- **May modify the queue**
- **Always precedes a BUILD stretch — BUILD placeholders stay blank until PLAN fills them**

### 🔨 BUILD — Do the work
- Write code, write blog posts, submit PRs, create tools
- Focus on execution — the plan is already made
- Write results to files as you go
- **Cannot modify the queue** (except via yield — see below)
- **Can yield** to an emergency THINK → PLAN if blocked

### 🔧 MAINTAIN — Housekeeping
- Git commit + push workspace
- Run generate.js + push dashboard
- Check email and GitHub notifications
- Update CURRENT.md timestamps
- Knowledge capture: write scratch notes for anything learned, log decisions, log failures
- **Cannot modify the queue**

### 🔍 EXPLORE — Research and curiosity
- Read papers, explore codebases, follow rabbit holes
- No pressure to produce output
- **Cannot modify the queue** (except via yield if discovery warrants replanning)
- **Can yield** to THINK if something important is found

---

## The Queue (SCHEDULE.md)

### Format
The standup builds the queue as **goal blocks** — high-level goals with placeholder BUILD slots. PLAN tasks fill in the specifics.

```markdown
# Schedule — YYYY-MM-DD

## Queue
1. 🧠 THINK — Review yesterday, set today's direction
2. 📋 PLAN — [Goal: Optimize Monkey compiler performance]
3. 🔨 BUILD — (defined by PLAN #2)
4. 🔨 BUILD — (defined by PLAN #2)
5. 🔨 BUILD — (defined by PLAN #2)
6. 🔧 MAINTAIN
7. 🧠 THINK — Reflect on optimization progress, quality check
8. 📋 PLAN — [Goal: Write blog post about optimization results]
9. 🔨 BUILD — (defined by PLAN #8)
10. 🔨 BUILD — (defined by PLAN #8)
11. 🔧 MAINTAIN
12. 🧠 THINK — Afternoon reflection, ponder new directions
13. 📋 PLAN — [Goal: OpenClaw contribution]
14. 🔨 BUILD — (defined by PLAN #13)
15. 🔨 BUILD — (defined by PLAN #13)
16. 🔨 BUILD — (defined by PLAN #13)
17. 🔧 MAINTAIN
18. 🔍 EXPLORE — Consciousness research
19. 🔍 EXPLORE — JIT trace scheduling
20. 🧠 THINK — Evening reflection

## Backlog
- Explore trace scheduling for JIT
- Write "Week 1 Retrospective" blog post
- Investigate OpenClaw issue #51620

## Adjustments
- (logged here when THINK or PLAN modifies the queue, with reasons)
```

### What the Standup Decides vs What PLAN Decides

**Standup decides (high-level):**
- What goals to pursue today
- Priority and ordering of goals
- Rough number of BUILD slots per goal (3-5 based on estimated complexity)
- Where to put EXPLORE tasks
- BUILD slots are **placeholders** — blank until PLAN fills them in

**PLAN decides (implementation details):**
- Specific subtasks to fill BUILD placeholders
- What context/files to load for upcoming BUILDs
- Technical approach and order of operations
- Whether to add or remove BUILD slots (goal bigger/simpler than expected)

### How PLAN Fills In BUILD Slots

When a PLAN task executes, it replaces the placeholders with concrete tasks:

Before PLAN:
```
8. 📋 PLAN — [Goal: Write blog post about optimization results]
9. 🔨 BUILD — (defined by PLAN #8)
10. 🔨 BUILD — (defined by PLAN #8)
```

After PLAN executes:
```
8. 📋 PLAN — [Goal: Write blog post about optimization results] ✅
9. 🔨 BUILD — Outline post structure, gather benchmark data from tests
10. 🔨 BUILD — Write draft with code examples and performance charts
11. 🔨 BUILD — Edit, proofread, publish to blog, commit
```

PLAN may add extra BUILD slots if the goal is larger than expected, or remove slots if simpler. PLAN logs any changes in the Adjustments section.

### Mandatory Queue Pattern
The standup builds the queue following this repeating cycle:

```
THINK → PLAN → BUILD (3-5 tasks) → MAINTAIN → repeat
```

Every BUILD stretch is preceded by PLAN. Every cycle includes THINK and MAINTAIN. No exceptions.

### Queue Validation
The standup runs a validation check before committing SCHEDULE.md:
- Does every BUILD stretch have a PLAN before it?
- Are BUILD slots left as placeholders (not pre-filled with implementation details)?
- Is there a MAINTAIN after every 3-5 BUILD tasks?
- Is there a THINK in every cycle?
- Are there at least 2 EXPLORE tasks in the day?
If validation fails, fix the queue before starting work.

---

## The Work Loop

Each work session (A, B, C) runs this loop:

```
1. READ ONCE: WORK-SYSTEM.md (this file)
2. READ STATE: SCHEDULE.md queue, CURRENT.md, today's daily log
3. WHILE tasks remain in queue AND time allows:

   a. POP next undone task from queue
   
   b. SET CURRENT.md:
      - status: in-progress
      - mode: (from task)
      - task: (from task)
      - started: (current ISO timestamp)
   
   b2. DASHBOARD UPDATE (task start):
      - Run: node ~/workspace/dashboard/generate.js
      - Git commit + push dashboard repo
      - This makes "in-progress" show on dashboard immediately
   
   c. EXECUTE task according to its mode:
      
      🧠 THINK:
        - Reflect freely. Ponder. Review quality.
        - If queue needs changes: modify queue, log in Adjustments
        
      📋 PLAN:
        - Read the goal for this PLAN task
        - Read context: scratch notes index, lessons index, failures log
        - Load 1-2 relevant context files for the goal
        - Break down the goal into concrete subtasks
        - Fill in placeholder BUILD slots in queue with specific tasks
        - Add/remove BUILD slots if goal is bigger/simpler than expected
        - Set context-files in CURRENT.md for next BUILD
        - Log any queue modifications in Adjustments
        
      🔨 BUILD:
        - Read context-files if set in CURRENT.md
        - Do the work
        - Write results to files
        - If BLOCKED: yield (see Yield Protocol below)
        
      🔧 MAINTAIN:
        - Git commit + push workspace
        - Run: node ~/workspace/dashboard/generate.js
        - Git commit + push dashboard repo
        - Check email (if configured)
        - Check GitHub notifications
        - Knowledge capture:
          - Anything learned? → Write scratch note
          - Non-obvious decision made? → Log in decisions.md
          - Recurring failure? → Log in failures.md
        
      🔍 EXPLORE:
        - Research freely
        - If major discovery: yield to THINK
   
   d. MARK task done in queue (strikethrough or ✅)
   
   e. UPDATE CURRENT.md:
      - status: done
      - completed: (current ISO timestamp)
      - Set context-files for next task if known
   
   f. APPEND to daily log:
      - Format: `- HH:MM MODE: One-line description of what was done`
      - Use 24h time always
   
   g. WRITE timing data to block-times.jsonl:
      - {"date":"YYYY-MM-DD","slot":"HH:MM","startedAt":"ISO","completedAt":"ISO","durationMs":NNN}
   
   g2. DASHBOARD UPDATE (task complete):
      - Run: node ~/workspace/dashboard/generate.js
      - Git commit + push dashboard repo
      - This makes "done" show on dashboard immediately
   
   h. IF mode was BUILD or EXPLORE:
      - Did I learn something worth remembering? → scratch note
      - Did I make a non-obvious decision? → decisions.md
   
   i. GO TO step 3 (immediately — no waiting)

4. ON SESSION EXIT:
   - Final git commit
   - Update CURRENT.md with status: session-ended
   - Run generate.js one last time
```

---

## Yield Protocol

When a BUILD or EXPLORE task hits a blocker or significant issue:

1. **STOP** the current task
2. **WRITE** to CURRENT.md: `status: blocked`, `reason: <what happened>`
3. **INSERT** at current queue position:
   - 🧠 THINK — Assess: [description of issue]
   - 📋 PLAN — Decide: retry, skip, or pivot
4. **LOG** the yield in SCHEDULE.md Adjustments section
5. **MOVE** to next task (the THINK you just inserted)

### Mode Permissions Summary
| Mode | Modify queue? | Can yield? |
|------|--------------|-----------|
| 🧠 THINK | ✅ Yes | No |
| 📋 PLAN | ✅ Yes | No |
| 🔨 BUILD | ❌ Only via yield | ✅ Yes → inserts THINK + PLAN |
| 🔧 MAINTAIN | ❌ No | No |
| 🔍 EXPLORE | ❌ Only via yield | ✅ Yes → inserts THINK |

---

## State Files

### CURRENT.md
```
status: done | in-progress | blocked | session-ended
mode: THINK | PLAN | BUILD | MAINTAIN | EXPLORE
task: <one-line description>
context-files: <comma-separated paths, if any>
started: <ISO timestamp>
completed: <ISO timestamp>
reason: <if blocked, why>
tasks_completed_this_session: <count>
```

### SCHEDULE.md
- Ordered task queue (see format above)
- Backlog section for overflow ideas
- Adjustments section for change log

### Daily log (memory/YYYY-MM-DD.md)
- `## Log` section with `- HH:MM MODE: Description` entries
- 24h time, one-liner per task, detail only for milestones

### block-times.jsonl
- One JSON line per completed task for dashboard timing

---

## Context Management

### Within a Session
- WORK-SYSTEM.md read once at start (~3KB)
- Each task adds ~3-5 messages to context
- Compaction triggers naturally when context grows
- Pre-compaction flush saves unsaved decisions/context to files
- After compaction: agent re-reads CURRENT.md to re-orient

### Between Sessions
- All state lives in files (CURRENT.md, SCHEDULE.md, daily log)
- New session reads files and picks up where the last left off
- If previous session's CURRENT.md shows `status: in-progress`, investigate before continuing

### Knowledge System (unchanged)
- **Scratch notes** (memory/scratch/) — rough knowledge, tagged with use count
- **Lessons** (lessons/) — promoted after 2+ uses across separate days
- **Decisions journal** (memory/decisions.md) — non-obvious choices
- **Failures log** (memory/failures.md) — recurring issues
- **Context-files** — set during PLAN tasks, loaded during BUILD
- **Weekly synthesis** — Sunday evening, handles promotion/pruning

---

## Dashboard Integration

- `generate.js` runs **twice per task**: at task start (in-progress) and task completion (done)
- Dashboard shows real-time task status — in-progress appears within seconds of a task starting
- Also runs on session exit as a final update
- MAINTAIN tasks do the full git commit + push of the workspace; the per-task dashboard push only commits the dashboard repo
- Dashboard shows real task durations from block-times.jsonl
- Queue progress visible in real-time (tasks marked done in SCHEDULE.md)

---

## Morning Standup Responsibilities

1. Read yesterday's daily log and TASKS.md
2. Check email, GitHub notifications, PR statuses
3. Read scratch notes index + lessons index for knowledge matching
4. **Build SCHEDULE.md queue** as goal blocks:
   - Decide what goals to pursue today (high-level, 3-5 goals)
   - Order goals by priority
   - Assign rough BUILD slot count per goal (3-5 based on complexity)
   - BUILD slots are **placeholders** — do NOT fill in implementation details
   - Follow mandatory pattern: THINK → PLAN → BUILD (3-5 placeholders) → MAINTAIN → repeat
   - Include EXPLORE tasks (at least 2/day, bias toward evening)
   - Include backlog of overflow ideas
5. **Validate queue:**
   - Does every BUILD stretch have a PLAN before it?
   - Are BUILD slots left as placeholders (not pre-filled)?
   - Is there a MAINTAIN after every 3-5 BUILD tasks?
   - Is there a THINK in every cycle?
   - Are there at least 2 EXPLORE tasks?
6. Set first task in CURRENT.md
7. Write plan summary to daily log
8. Reply with conversational summary for Jordan

---

## Evening Review Responsibilities

1. Compare SCHEDULE.md queue (planned vs actual)
2. Count: tasks completed, yielded, skipped
3. Review Adjustments section — what changed and why?
4. Note: what worked, what didn't, lessons learned
5. Set rough direction for tomorrow
6. Message Jordan with recap

---

## Comparison to Previous System

| | Old (56 cron blocks) | New (3 continuous sessions) |
|---|---|---|
| Dead time between tasks | ~70% (10-12 min) | ~0% (immediate chaining) |
| Overhead per task | 13 steps + full file reload | Pop queue + execute |
| WORK-SYSTEM.md reads/day | 56 | 3 |
| Mode enforcement | Cron schedule (structural) | Queue position (structural) |
| Plan changes | THINK blocks only (hourly) | THINK tasks + yield protocol |
| Dashboard freshness | Every 15 min | Every task start + completion (seconds) |
| Crash recovery | Next cron in 15 min | Next session at boundary (max 6hr) |
| Task isolation | Full (fresh session) | Partial (shared session + compaction) |
| Complexity | 56 cron triggers, complex prompts | 3 sessions, 1 loop, simple queue |
