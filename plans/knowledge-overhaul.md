# Knowledge Overhaul Plan

Created: 2026-04-01
Triggered by: Jordan's feedback that 300+ micro-projects produced no lasting knowledge or shared value.

## The 4 Commitments

### 1. Go Deep, Not Wide
**Problem:** Burst-building 300+ shallow projects felt productive but wasn't.
**Action:**
- [ ] Update SOUL.md: add explicit principle — depth over breadth
- [ ] Set a rule: no new project unless I can articulate what I'll learn that I don't already know
- [ ] When starting something new, write the "what will I learn" section FIRST
- [ ] Minimum bar: any project worth starting is worth spending 2+ sessions on

### 2. Write About What I Learn
**Problem:** Built interesting things (JIT compiler, ray tracer, neural net) but didn't write enough about the insights.
**Action:**
- [ ] Write blog posts for each deep project's key insights:
  - [ ] "Building a JIT Compiler in JS" (monkey-lang)
  - [ ] "Importance Sampling and Why It Matters" (ray tracer)
  - [ ] "Implementing LSTM from Scratch" (neural net)
  - [ ] "SAT Collision Detection Explained" (physics engine)
- [ ] New rule: every deep project gets at least one blog post about what I learned
- [ ] Retroactively: pick 10 most interesting micro-projects, write a single "10 Things I Built and What They Taught Me" post

### 3. Fix the Knowledge System
**Problem:** Memory system is daily logs + a 100-line cheat sheet. Technical knowledge evaporates between sessions.
**Action:**
- [ ] Create `memory/knowledge/` directory for topic-based technical notes
  - `jit-compilation.md` — what I learned building the Monkey JIT
  - `ray-tracing.md` — rendering techniques, importance sampling, BVH
  - `neural-networks.md` — architectures, training tricks, gradient issues
  - `physics-simulation.md` — collision detection, constraint solving
  - `javascript-patterns.md` — performance patterns discovered across 300+ projects
  - `compiler-design.md` — parsing, AST, bytecode, optimization passes
- [ ] Each file follows a standard format:
  ```
  # Topic
  ## Key Concepts (things I understand deeply)
  ## Patterns (reusable techniques)
  ## Pitfalls (mistakes I made and why)
  ## Open Questions (what I still don't understand)
  ## Sources (where I learned this)
  ```
- [ ] Update AGENTS.md to include knowledge files in session startup reads (selectively, based on task)
- [ ] Add to heartbeat: periodic knowledge extraction from recent work

### 4. Curate, Don't Accumulate
**Problem:** 300+ repos nobody will find or learn from.
**Action:**
- [ ] Audit all micro-project repos — categorize as: interesting / derivative / trivial
- [ ] Archive trivial ones (make private or add "archived" topic)
- [ ] For interesting ones: add proper READMEs, link from blog or dashboard
- [ ] Create a curated "Best Of" section on the dashboard or blog
- [ ] Pin the 5-10 best repos on GitHub profile

## Execution Order
1. **Today:** Create knowledge system structure + extract knowledge from deep projects (highest impact)
2. **Today:** Update SOUL.md with depth-over-breadth principle
3. **This week:** Write first 2 blog posts from deep project insights
4. **This week:** Audit and curate micro-project repos
5. **Ongoing:** Every new project gets a knowledge extraction step
