---
uses: 1
created: 2026-03-24
last-used: 2026-03-24
topics: v8, turbofan, meta-jit, monkey-jit, optimization-layers
---

# Meta-JIT: What V8 Does With Monkey's Generated JavaScript

## The Setup

Monkey JIT compiles Monkey bytecode → JavaScript via `new Function()`. V8 then JIT-compiles that JavaScript → machine code. Two JIT layers, each doing their own optimization. What does V8 actually see and do?

## A Real Trace (sum 0..99)

```javascript
"use strict";
let __iterations = 0;
let v0 = __globals[0].value;       // sum (promoted)
let v1 = __globals[1].value;       // i (promoted)
const v2 = 100;
const v3 = 1;
loop: while (true) {
  if ((++__iterations & 0x7F) === 0 && __iterations > 100000) return __wb({...});
  const v8 = v2 > v1;
  if (!v8) { /* guard exit with snapshot */ return __wb({...}); }
  v0 = v0 + v1;
  v1 = v1 + v3;
  continue loop;
}
```

## What V8's Ignition (Interpreter) Sees
- Tight while loop with labeled continue
- Two mutable locals (`v0`, `v1`), two constants (`v2`, `v3`)
- One branch (guard check), one arithmetic path
- `__wb` and `__globals` are closure-captured variables

V8's profiling will quickly identify this as hot. Back-edge counter triggers TurboFan compilation.

## What TurboFan (Optimizing Compiler) Does

### 1. Type Feedback
After a few iterations, V8 knows:
- `v0`, `v1`, `v2`, `v3` are always Smis (small integers, no heap allocation)
- `v2 > v1` always produces boolean
- `v0 + v1` and `v1 + v3` always produce Smis (until overflow)

### 2. Inlining
- The `__iterations` check (`(++__iterations & 0x7F) === 0`) is almost always false — TurboFan will predict the branch as not-taken
- The guard exit path (`!v8`) creates a deopt point but TurboFan sees it's rarely taken

### 3. Loop Optimizations
- `v2` (100) and `v3` (1) are constants — hoisted out of the loop (redundant with our LICM, but V8 does it again)
- The loop body becomes: load v0, load v1, compare, add, add, store, store
- Register allocation: v0 and v1 likely live in CPU registers for the entire loop

### 4. What Gets Generated (x86-64, approximate)
```asm
.loop:
  cmp v1_reg, 100         ; v2 > v1 → 100 > v1 → v1 < 100
  jge .guard_exit          ; branch to deopt stub
  add v0_reg, v1_reg       ; v0 = v0 + v1  
  jo .overflow_deopt       ; Smi overflow check (V8 adds this!)
  add v1_reg, 1            ; v1 = v1 + 1
  jo .overflow_deopt       ; another overflow check
  ; iterations counter check elided by branch prediction / loop peeling
  jmp .loop
```

### 5. The Double Optimization
Interesting: both Monkey JIT and V8 independently:
- Promote variables to registers (Monkey: variable promotion to raw JS values; V8: register allocation)
- Hoist constants (Monkey: LICM; V8: constant folding)
- Eliminate type checks (Monkey: guard elimination for redundant guards; V8: type feedback specialization)

But V8 adds things Monkey can't:
- **Smi overflow checks** — V8 adds integer overflow guards on every addition (these deopt to handle BigInt/Double transitions)
- **Register allocation** — actual CPU register assignment
- **Instruction selection** — mapping JS operations to x86 instructions
- **Loop peeling** — first iteration might be unrolled for better branch prediction

## The Collaboration

The two JITs complement each other beautifully:

**Monkey JIT eliminates:** interpreter dispatch, object boxing, type tag checks, hash lookups, array bounds checks (where safe), stack manipulation
**V8 eliminates:** JS overhead, dynamic dispatch, heap allocation for intermediates, adds register allocation and machine code generation

**What neither eliminates (but could):**
- The `__wb` write-back function (V8 can't know it's only called on exit)
- The `__iterations` counter (V8 can predict the branch but still increments)
- The `__globals` array indirection (V8 sees it as a closure variable, might not inline the access)

## Optimization Interference

Sometimes the two layers fight:
1. **Monkey's `__wb` function** prevents V8 from fully inlining the exit path. V8 sees a function call in the deopt path and may not inline it (it's cold code).
2. **Monkey's labeled `continue loop`** — V8 handles this fine, but it creates a slightly different control flow graph than a simple `while(true)` would.
3. **The `__sideTraces` check** — V8 sees a property lookup + conditional call on every guard exit. This is dead code on the happy path but V8 still has to model it.

## What Monkey Could Do Better (For V8)

1. **Avoid `new Function()` if possible** — V8 can't inline across `new Function()` boundaries. But there's no alternative for runtime code generation in JS.
2. **Use `let` consistently** — V8's TurboFan handles `let` and `const` equally well in loops, but `const` gives slightly better type narrowing.
3. **Minimize closure captures** — every `__globals`, `__consts`, etc. is a closure variable that V8 loads from the closure record. Could pack these into a single context object.
4. **Emit overflow checks explicitly** — instead of relying on V8's Smi overflow detection, Monkey could emit `(v0 + v1) | 0` to signal integer intent. But this truncates to 32-bit...

## Key Insight

**The meta-JIT architecture is surprisingly efficient.** V8 is excellent at optimizing the patterns Monkey JIT produces because they're simple: tight loops, raw arithmetic, branch-free hot paths. The overhead of the two-layer approach is small — maybe 10-20% vs native machine code — but the implementation cost is dramatically lower (thousands of lines of JS vs hundreds of thousands of lines of C++).

This is why "compile to JS" JITs are viable for educational and prototyping purposes. You get 80% of the performance for 1% of the implementation effort.

## Experiment Ideas
- Run with `--trace-turbo` to see actual V8 optimization decisions on Monkey traces
- Compare with `--no-turbo` to measure V8's contribution vs Monkey's
- Try `--trace-deopt` to see if V8 ever deopts inside Monkey traces
