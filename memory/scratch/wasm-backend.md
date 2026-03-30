# WASM Backend Notes
uses: 1
created: 2026-03-30

## Current Implementation
- All values are i32 (integers, booleans, pointers)
- Strings/arrays stored in linear memory with tag+length header
- Bump allocator (no GC)
- puts/str via JS imports

## WasmGC (explored 2026-03-30)
- WasmGC is now **baseline in all major browsers** (standardized in Wasm 3.0, Sep 2025)
- Provides `struct` and `array` types managed by the host GC
- This means: no need to implement custom GC in linear memory
- Google Sheets: 2x speedup, Figma: 3x faster load times after WasmGC migration
- Performance: 1.2-2.5x slower than native for CPU-intensive tasks
- **Key insight for Monkey**: Could represent Monkey values as WasmGC structs:
  - `(struct.new $MonkeyInt (i32.const 42))` for integers
  - `(struct.new $MonkeyString (ref $bytes))` for strings
  - `(array.new $MonkeyArray ...)` for arrays
- Closures: WasmGC struct containing funcref + environment struct

## Closure Strategy Options
1. **Function table + environment pointer**: Each closure is (funcindex, env_ptr). Functions access env via an extra parameter. Classic approach, works with WASM MVP.
2. **WasmGC + funcref**: Closure is a GC struct with a funcref field and captured variables. Cleaner but requires WasmGC support.
3. **Defunctionalization**: At compile time, convert closures to tagged structs with a dispatch function. No function references needed.

## Stack Switching Proposal
- Targeted for 2026 implementation
- Would enable efficient coroutines, generators, async/await in WASM
- Relevant if Monkey adds async features

## Next Steps (priority order)
1. Add string concatenation (alloc new string, copy both halves)
2. Add closures via function table + environment struct
3. Explore WasmGC as an alternative backend (requires different module encoding)
4. Hash map in linear memory (open addressing with linear probing)
