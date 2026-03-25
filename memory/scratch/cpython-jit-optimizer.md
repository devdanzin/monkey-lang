# CPython JIT Optimizer Pipeline Notes

## Architecture
- Single-pass abstract interpretation over micro-ops (uops)
- `optimizer_bytecodes.c`: per-uop symbolic evaluation rules
- `optimizer_symbols.c`: symbol types (const, typed, unknown, bottom)
- `JitOptSymbol`: tracks type, const value, nullness, type version
- Guards are eliminated by replacing with `_NOP` when symbolic state proves them

## Key differences from Monkey JIT
1. **Single-pass vs multi-pass**: CPython does one pass; we do 10+ passes
2. **Symbol-based vs ref-based**: CPython tracks types symbolically; we track IR refs
3. **No integer ranges**: CPython tracks "is compact int" but not value ranges
4. **Constant-only bounds elim**: Only eliminates tuple bounds when index is const

## Potential contribution: Integer range tracking
- Add range info (min, max) to JitOptSymbol for compact ints
- When `_GUARD_BINARY_OP_SUBSCR_*_BOUNDS` sees a range-checked index, eliminate
- Would require tracking through BINARY_OP_ADD_INT (increment narrows range)
- Complex but high-value for array-heavy Python code

## Simpler contribution: _SET_IP size reduction (#145742)
- Replace 64-bit IP stores with 16-bit offsets
- Well-defined, mechanical change
- Would need to update all readers of frame->instr_ptr
- Good "first contribution" but still significant

## Status
- Commented on #146073 (trace quality), no response yet
- Watching: #145742 (code size), #146368 (recursion depth)
- Not ready to submit PR yet — need to build CPython and run tests first
