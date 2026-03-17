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
