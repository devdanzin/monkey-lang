---
uses: 2
created: 2026-03-22
last-used: 2026-03-22
topics: jit, side-traces, guard-exit, trace-linking
---
# Side Trace Architecture for Monkey JIT

## Design Decision: VM-dispatched side traces (not parent patching)

LuaJIT patches parent machine code to jump directly to side traces. We can't do that with JS `new Function()`. Instead:

### Approach: Side trace map on parent Trace object

```
trace.sideTraces = Map<guardIdx, Trace>  // compiled side traces
```

**VM dispatch flow:**
1. Execute parent trace → guard fails → returns `{ exit: "guard", guardIdx, ip }`
2. VM checks `trace.sideTraces.get(guardIdx)`
3. If side trace exists → execute it (same _executeTrace flow)
4. If side trace returns to loop header → re-enter parent trace
5. If no side trace → fall to interpreter as before

**Side trace recording:**
- Triggered when `sideExits.get(guardIdx) >= HOT_EXIT_THRESHOLD` (8)
- Start recording at the guard's exitIp
- Set a flag: `recorder.isSideTrace = true`, `recorder.parentTrace = trace`, `recorder.parentGuardIdx = guardIdx`
- Recording ends when:
  a) We reach the parent's loop header (startIp) → link type LOOP_BACK
  b) We reach our own loop header → nested loop, compile as root trace
  c) Max length / abort

**Side trace compilation:**
- Same TraceCompiler, but:
  - State comes from the parent's exit (stack/globals already written back by parent)
  - Can inherit type info from parent at the exit point
  - When trace ends at parent loop header, return `{ exit: "loop_back" }` so VM re-enters parent

**What changes:**
1. `JIT` class: add `HOT_EXIT_THRESHOLD`, side trace triggering logic
2. `Trace` class: add `sideTraces` map, `isSideTrace`, `parentTrace` fields
3. `TraceRecorder`: accept side trace mode (start at exitIp, end at parent loop header)
4. `VM._executeTrace()`: check sideTraces before falling to interpreter
5. `VM` loop: after executing parent trace, if result was loop_back, loop and re-execute parent

**Key insight:** Since compiled traces already write back to stack/globals on exit, the side trace can just read from the same stack/globals. No special state passing needed. The VM's stack IS the snapshot.

## Estimated complexity
- ~50 lines in JIT/Trace classes
- ~20 lines in recorder (side trace stop condition)
- ~30 lines in VM (side trace dispatch + loop_back handling)
- ~100 lines total, plus tests

## Open questions
- Should side traces get their own optimizer pass? (Yes, same pipeline)
- Max side traces per root? (Start with 4, like LuaJIT's tryside)
- Can side traces have side traces? (Not initially — keep it one level deep)
