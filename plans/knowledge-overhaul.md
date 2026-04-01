# Knowledge Overhaul Plan (v2)

Created: 2026-04-01
Revised after discovering the existing scratch → promote pipeline.

## The Real Problem

Jordan's critique wasn't just "300 projects are shallow." It's that **knowledge gets written but never reliably accessed.** The scratch note system has:
- 19 detailed scratch notes (122KB of real technical knowledge)
- Usage tracking, promotion candidates, weekly synthesis/merging
- An INDEX.md that categorizes everything

But:
1. **Session startup doesn't read it.** AGENTS.md says read SOUL.md, USER.md, GUARDRAILS.md, daily logs. NOT scratch/INDEX.md.
2. **The lesson promotion pipeline is broken.** W13 synthesis says notes were "promoted to lessons/tracing-jit.md" but the `lessons/` directory doesn't exist.
3. **No retrieval trigger.** Even if knowledge files exist, nothing tells a session "you're about to work on JIT stuff, read jit-compilation.md first."
4. **I created a parallel `memory/knowledge/` system** that duplicates the scratch notes with less detail.

## The Fix

### 1. Merge knowledge/ into the existing system
- Delete the 5 knowledge files I just created (they're weaker versions of existing scratch notes)
- Create the `memory/lessons/` directory that was supposed to exist
- Actually promote the candidates from W13: cpython-internals, copy-and-patch → lessons/
- Consolidate: scratch = working notes, lessons = distilled durable knowledge

### 2. Fix retrieval: topic-aware session loading
- Update AGENTS.md session startup to include: "Read `memory/scratch/INDEX.md` to know what knowledge is available"
- Add to standup/session start: "If today's work relates to a topic in INDEX.md, read the relevant scratch notes"
- The memory_search tool should catch these via semantic search, but explicit INDEX reading is the backup

### 3. Fix the promotion pipeline
- Create `memory/lessons/` with actual promoted content
- Lessons format: distilled from scratch notes, focused on reusable patterns and pitfalls
- Each lesson links back to source scratch notes for detail

### 4. Make knowledge extraction a project completion step
- Update SOUL.md: "When finishing a project, write what you learned to a scratch note or update an existing lesson"
- This is the "depth over breadth" principle in action — knowledge only counts if it's captured

### 5. Audit scratch notes for quality
- Some scratch notes are excellent (copy-and-patch: 8KB of detailed architecture analysis)
- Some are thin (dashboard-server-deployment: just PATH notes)
- Promote the excellent ones, archive or merge the thin ones

## Execution
1. Delete `memory/knowledge/` (redundant with scratch system)
2. Create `memory/lessons/` and promote ready candidates
3. Update AGENTS.md session startup to include knowledge retrieval
4. Update SOUL.md with project completion knowledge extraction step
5. Update scratch/INDEX.md with current state
6. Commit
