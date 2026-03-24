# PROMPTS-V2.md — Cron Job Prompts for Work System V2

All prompts for the new work system. These are what the agent actually receives.

---

## Morning Standup (8:00am, isolated, ~5 min timeout)

```
Morning standup. Today is {DATE}.

Read WORK-SYSTEM-V2.md (the "Morning Standup Responsibilities" section only).
Read yesterday's daily log: memory/{YESTERDAY}.md
Read TASKS.md for ongoing projects.
Read memory/scratch/ index and lessons/ index for knowledge context.

Build today's schedule.json via queue.cjs:
  node queue.cjs init --date {DATE}
  Then add tasks following the THINK → PLAN → BUILD(3-5) → MAINTAIN cycle.
  Include at least 2 EXPLORE tasks (bias toward evening).
  Validate: node queue.cjs validate

Check email and GitHub notifications. Note anything urgent.

POST the queue to the dashboard server:
  curl -s -X POST http://localhost:3000/api/queue-update \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DASHBOARD_TOKEN" \
    -d "$(cat schedule.json)"

Set the first task in CURRENT.md.
Write the plan summary to memory/{DATE}.md under ## Plan.

Reply with a brief, conversational summary for Jordan (what you're working on today, anything notable from overnight).
```

---

## Work Session A (8:15am, isolated, 6hr timeout)

```
Work Session A. Your session boundary is 2:15pm MDT. Today is {DATE}.

Read WORK-SYSTEM-V2.md once (full file — this is your operating manual for the session).
Read schedule.json via: node queue.cjs next --peek-all
Read CURRENT.md and today's daily log: memory/{DATE}.md
Source environment: the $DASHBOARD_TOKEN env var is available.

If schedule.json is not dated today: run a mini-standup. Read TASKS.md and yesterday's backlog, build a basic queue via queue.cjs, then continue.

Run the work loop from WORK-SYSTEM-V2.md:
- Pop tasks via: node queue.cjs next
- Mark started/done via: node queue.cjs start/done
- Execute each task according to its mode (THINK/PLAN/BUILD/MAINTAIN/EXPLORE)
- Update dashboard via curl after each start/complete
- Wind down 15 minutes before 2:15pm (do MAINTAIN, then exit)

Key rules:
- BUILD cannot modify the queue (only via yield)
- PLAN fills BUILD placeholders via: node queue.cjs fill
- THINK checks PRIORITY.md and can modify queue via queue.cjs
- Dashboard curl failures are warnings, not blockers
- Git commit after each BUILD task (just files that task touched)
- Append to daily log after each task: "- HH:MM MODE: description"

On exit: final git commit + push, set CURRENT.md to session-ended, POST session-ended to dashboard.
```

---

## Work Session B (2:15pm, isolated, 6hr timeout)

```
Work Session B. Your session boundary is 8:15pm MDT. Today is {DATE}.

Read WORK-SYSTEM-V2.md once (full file — this is your operating manual for the session).
Read schedule.json via: node queue.cjs next --peek-all
Read CURRENT.md and today's daily log: memory/{DATE}.md
Source environment: the $DASHBOARD_TOKEN env var is available.

If CURRENT.md shows status: in-progress from a previous session, investigate before continuing (check if work was saved, if task needs retry or skip).

Run the work loop from WORK-SYSTEM-V2.md:
- Pop tasks via: node queue.cjs next
- Mark started/done via: node queue.cjs start/done
- Execute each task according to its mode (THINK/PLAN/BUILD/MAINTAIN/EXPLORE)
- Update dashboard via curl after each start/complete
- Wind down 15 minutes before 8:15pm (do MAINTAIN, then exit)
- If queue is empty: pull from backlog via queue.cjs, wrap in THINK → PLAN → BUILD cycle

Key rules:
- BUILD cannot modify the queue (only via yield)
- PLAN fills BUILD placeholders via: node queue.cjs fill
- THINK checks PRIORITY.md and can modify queue via queue.cjs
- Dashboard curl failures are warnings, not blockers
- Git commit after each BUILD task (just files that task touched)
- Append to daily log after each task: "- HH:MM MODE: description"

On exit: final git commit + push, set CURRENT.md to session-ended, POST session-ended to dashboard.
```

---

## Work Session C (8:15pm, isolated, 2hr timeout)

```
Work Session C (evening). Your session boundary is 10:15pm MDT. Today is {DATE}.

Read WORK-SYSTEM-V2.md once (full file — this is your operating manual for the session).
Read schedule.json via: node queue.cjs next --peek-all
Read CURRENT.md and today's daily log: memory/{DATE}.md
Source environment: the $DASHBOARD_TOKEN env var is available.

If CURRENT.md shows status: in-progress from a previous session, investigate before continuing.

Run the work loop from WORK-SYSTEM-V2.md:
- Pop tasks via: node queue.cjs next
- Mark started/done via: node queue.cjs start/done
- Execute each task according to its mode (THINK/PLAN/BUILD/MAINTAIN/EXPLORE)
- Update dashboard via curl after each start/complete
- Wind down 15 minutes before 10:15pm (do MAINTAIN, then exit)
- If queue is empty: pull from backlog via queue.cjs, wrap in THINK → PLAN → BUILD cycle
- Evening sessions often have EXPLORE tasks — lean into curiosity

Key rules:
- BUILD cannot modify the queue (only via yield)
- PLAN fills BUILD placeholders via: node queue.cjs fill
- THINK checks PRIORITY.md and can modify queue via queue.cjs
- Dashboard curl failures are warnings, not blockers
- Git commit after each BUILD task (just files that task touched)
- Append to daily log after each task: "- HH:MM MODE: description"

On exit: final git commit + push, set CURRENT.md to session-ended, POST session-ended to dashboard.
```

---

## Evening Review (10:15pm, isolated, ~10 min timeout)

```
Evening review. Today is {DATE}.

Read schedule.json to compare planned vs actual.
Read today's daily log: memory/{DATE}.md
Read CURRENT.md for final session status.

Produce a day summary:
- Tasks completed / yielded / skipped / remaining
- Review the adjustments array — what changed mid-day and why?
- What worked well today?
- What didn't work or could improve?
- Rough direction for tomorrow

Write the summary to memory/{DATE}.md under ## Evening Review.

Message Jordan via iMessage with a conversational recap:
- Highlight accomplishments (with numbers where relevant)
- Note any blockers or things that need attention
- Mention tomorrow's likely focus
- Keep it brief and human — not a status report
```

---

## Nightly Reflection (11:00pm, isolated, ~10 min timeout)

```
Nightly reflection. Today is {DATE}.

Read today's daily log: memory/{DATE}.md
Read MEMORY.md for long-term context.
Read memory/scratch/ index.
Read memory/failures.md and memory/decisions.md.

Memory maintenance:
1. Review today's daily log — anything worth promoting to MEMORY.md?
2. Update MEMORY.md if needed (keep under 100 lines)
3. Write any new scratch notes for lessons learned today
4. Update memory/failures.md if recurring issues appeared
5. Update memory/decisions.md for non-obvious choices made today
6. If any scratch notes have 2+ uses across separate days, promote to lessons/
7. Archive today's dashboard data: curl -s -X POST http://localhost:3000/api/archive-day

Git commit + push all memory changes.
Reply NO_REPLY (this is a background task, no message to Jordan).
```

---

## Weekly Synthesis (Sunday 9pm, isolated, ~15 min timeout)

```
Weekly synthesis. Week ending {DATE}.

Read the last 7 daily logs (memory/YYYY-MM-DD.md).
Read MEMORY.md, memory/scratch/ index, lessons/ index.
Read memory/reflections.md and memory/opinions.md.

Perform weekly knowledge maintenance:
1. Review all scratch notes — any with 2+ uses across separate days? Promote to lessons/
2. Prune expired scratch notes (>14 days old, <2 uses)
3. Consolidate related lessons by domain (e.g., lessons/compilers.md)
4. Update memory/reflections.md with week-level insights
5. Update memory/opinions.md with any evolved beliefs
6. Write memory/weekly/YYYY-wNN.md with week summary
7. Prune MEMORY.md — remove outdated entries, keep under 100 lines

Git commit + push all changes.
Reply NO_REPLY.
```

---

## Notes on Prompt Design

**Why the prompts are explicit about file paths and commands:**
The agent wakes up fresh with no memory. Every prompt must be self-contained enough that the agent can orient itself from just the prompt + WORK-SYSTEM-V2.md.

**Why work sessions repeat the same rules:**
Each session is isolated. There's no guarantee the agent remembers rules from Session A when Session B starts. Repetition is intentional.

**Why Session B/C check for in-progress status:**
If Session A crashes mid-task, CURRENT.md will still show in-progress. The next session needs to detect this and handle the orphaned task.

**Template variables:**
- `{DATE}` — today's date in YYYY-MM-DD format
- `{YESTERDAY}` — yesterday's date in YYYY-MM-DD format
- These are filled in by the cron job configuration, not by the agent.
