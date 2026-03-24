# String Variable Promotion — Design Notes

## Current State
- Integer variables in hot loops are promoted to raw JS numbers
- String variables remain as MonkeyString objects
- CONCAT creates `new __MonkeyString(a.value + b.value)` — allocation every iteration

## Proposed Change
Promote string variables to raw JS strings, like integer promotion.

### New IR Instructions
- `UNBOX_STRING` — `MonkeyString → raw string` (just `.value`)
- `BOX_STRING` — `raw string → new MonkeyString(value)`
- `CONCAT_RAW` — `string + string → string` (raw JS concat, no allocation)

### Variable Promotion Changes
The codegen's variable promotion logic (currently only for integers) would also track
string globals/locals:

```javascript
// Before loop:
let s_raw = __globals[0].value;   // promoted string

// In loop:
s_raw = s_raw + v3.value;         // raw concat

// Write-back on exit:
__globals[0] = new __MonkeyString(s_raw);
```

### Complications
1. **Guard type**: GUARD_STRING already handles this
2. **CONCAT codegen**: Would need to detect when both operands are promoted/raw strings
3. **Box/Unbox elimination**: `UNBOX_STRING(BOX_STRING(x)) → x` (same pattern as int)
4. **Mixed operations**: `len(s)` needs unboxed string, `s + "a"` needs unboxed strings

### Expected Impact
- String concat benchmark: 6.7x → potentially 15-20x (eliminating allocation)
- String len check: 5.5x → potentially 10x+ (no .value access in loop)

### Implementation Effort
Medium — follows integer promotion pattern closely. ~100-150 lines of new code:
- 2 new IR ops
- Modify CONCAT codegen
- Extend promotion logic in TraceCompiler
- Add box/unbox elimination for strings
- Tests

## Decision
This is a good next feature for Session C. The pattern is well-understood from integer promotion.
Estimated time: 2-3 tasks in a BUILD cycle.
