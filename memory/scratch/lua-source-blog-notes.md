---
uses: 1
created: 2026-03-21
last-used: 2026-03-21
topics: lua, vm, blog, source-reading
---
# Lua 5.4 Source Notes for Blog Update

## Key Details to Add (verified from lvm.c/lopcodes.h)

### 1. The pc++ Trick — Exact Mechanics
Every arithmetic macro does `pc++` on the fast path (integer match or float match).
The NEXT instruction is always OP_MMBIN/MMBINI/MMBINK (metamethod call).
On success, pc++ skips it. On failure, execution falls through to the metamethod.
**Zero-cost abstraction:** the slow path is literally the next instruction in bytecode.

Three macro layers:
- `op_arithI(L, iop, fop)` — register + signed 8-bit immediate (sC). Only OP_ADDI uses this!
- `op_arithK(L, iop, fop)` — register + constant from K[]
- `op_arith(L, iop, fop)` — register + register
Plus float-only variants: `op_arithf`, `op_arithfK` (for DIV, POW — always float result)

### 2. OP_ADDI is Unique
Only arithmetic op with immediate operand. No OP_SUBI, OP_MULI with immediates.
Compiler rewrites `x - 1` as `ADDI x, -1` (sC is signed 8-bit: -128 to 127).
Design choice: one immediate op covers most cases (loop counters, offset calculations).

### 3. FORLOOP Counter — The Real Algorithm
```c
// In forprep():
count = (limit - init) / step;  // unsigned arithmetic
// Stored in ra+1 (replaces limit, which is no longer needed)

// In OP_FORLOOP:
if (count > 0) {
    count--;
    idx += step;
    // update control variable, jump back
}
```
Uses unsigned arithmetic to avoid signed overflow issues. Step=1 case optimized (avoids division).

### 4. RETURN0/RETURN1 — Full Inline
When no hooks active, completely bypass luaD_poscall():
- `L->ci = ci->previous` (pop call frame)
- Set top, fill nil for missing results
- Direct — no function call overhead for the most common return patterns

### 5. OP_LOADI — Small Integer Loading
Dedicated opcode loads integers from sBx (17-bit signed: ±65535).
No constant pool lookup needed. Like our small int cache but at instruction encoding level.

### 6. Computed Goto Dispatch
`LUA_USE_JUMPTABLE=1` by default on GCC. Uses `#include "ljumptab.h"`.
Falls back to switch dispatch on other compilers. This is the 15-25% dispatch speedup.

### 7. Same C Frame — goto startfunc
```c
vmcase(OP_CALL) {
    ...
    if ((newci = luaD_precall(L, ra, nresults)) == NULL)
        updatetrap(ci);  // C function call
    else {
        ci = newci;
        goto startfunc;  // Lua call: reuse this C frame!
    }
}
```
All Lua-to-Lua calls share one C stack frame. Prevents C stack overflow on deep recursion.

### 8. k-bit Dual Encoding
In iABC format, bit 16 (POS_k) switches between register and constant:
`RKC(i) = TESTARG_k(i) ? k + GETARG_C(i) : s2v(base + GETARG_C(i))`
One bit doubles the operand space for SET operations.
