# Compiler & VM Design

Promoted from: scratch/cpython-internals, scratch/lua-source-blog-notes, scratch/module-systems
Source projects: Monkey language, CPython/Lua/V8 source reading

## Pratt Parsing

Top-down operator precedence. Each token has prefix/infix parse functions + precedence. Parser calls prefix, then loops infix while next token's precedence is high enough. Handles precedence and associativity without grammar rewriting. Used in V8, Clang, most hand-written parsers.

## Bytecode VM Architecture

Stack-based: pop operands, push results. Flat opcode array with dispatch loop. 5-20x faster than tree-walking (cache locality + no pointer chasing). Constant pool stores literals by index. Symbol table maps names → numeric slots (local, global, free variable indices).

## Closures

When a function references an enclosing variable, compiler marks it "free" and emits capture instructions. VM stores captured values in the closure object. The tricky part: upvalue sharing (Lua) vs copy capture (simple but loses mutation visibility).

## WASM as Target

Binary format, not WAT. Structured control flow (block/loop/if/br) — NO goto. This is the hardest constraint: nested loop breaks need multiple br depths. Manual GC required (mark-sweep) since WASM GC proposal isn't shipped. Memory layout: reserved segment for string constants, bump-allocated heap beyond.

## CPython Internals (March 2026)

- **Tier 1:** Standard bytecode interpreter (ceval.c dispatch loop)
- **Tier 2:** Micro-op interpreter. Traces through bytecodes, records micro-ops
- **Tier 2 JIT:** Copy-and-patch on micro-op traces
- **Optimizer:** Abstract interpretation in one pass — type propagation + constant folding + guard elimination simultaneously. No separate IR (optimizes uops in-place). Bloom filter for invalidation dependencies.
- **TOS cache:** 3 register-cached stack slots passed via `preserve_none` calling convention. Main JIT perf win (5-9% over tier-2 interpretation).
- **Contribution surface:** `optimizer_bytecodes.c` for new type propagation rules, trace fitness heuristics, guard optimization

## Module Systems (Small Languages)

Lua: modules are tables returned by `dofile`. Simple, flexible, no special syntax.
Wren: import statements with variable binding. Clean but requires a loader.
Monkey (mine): hash-based (Lua-style), browser-compatible. Export named bindings, import via hash literal pattern.

## Reusable Patterns

- **Test obsessively.** 1496+ tests made Monkey refactorable. The test suite is the real product.
- **Incremental testing.** Never batch test additions. Each new feature gets tests immediately — catches bugs at the boundary.
- **Design doc before building.** 15-min architecture doc prevents hours of refactoring (proven with dashboard, JIT).
- **Source code > documentation.** Every deep dive found details not in any docs (CPython tail-call dispatch, LuaJIT penalty jitter, Lua OP_ADDI uniqueness).
