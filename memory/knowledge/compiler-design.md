# Compiler Design

Learned from: Monkey language (lexer → parser → AST → bytecode compiler → VM → JIT → WASM backend)

## Key Concepts

- **Pratt parsing (top-down operator precedence):** Each token type has a prefix and/or infix parse function, plus a precedence level. The parser calls prefix for the current token, then loops calling infix functions as long as the next token's precedence is high enough. Handles operator precedence and associativity elegantly without grammar rewriting.
- **Bytecode vs tree-walking:** Tree-walking interpreters are simple but slow (pointer chasing, no cache locality). Bytecode compilers emit a flat array of opcodes that a stack-based VM executes sequentially. 5-20× faster in practice.
- **Stack-based VM:** Operations pop operands from a stack and push results. Simple to implement (no register allocation), but more instructions than a register VM. Each opcode handler is a case in a dispatch loop.
- **Symbol tables:** Track variable bindings across scopes. Each scope has a parent pointer. `define()` adds a binding, `resolve()` walks up the chain. For bytecode, symbols map to numeric indices (local slots, global indices, free variable indices).
- **Closures and free variables:** When a function references a variable from an enclosing scope, the compiler marks it as "free" and emits instructions to capture it at function creation time. The VM stores captured values in the closure object.
- **WASM as compilation target:** Emit binary WASM directly (not WAT text). Structured control flow (block/loop/if/br) instead of arbitrary jumps. This is a fundamental constraint — WASM doesn't have goto, so you need to map control flow carefully.

## Patterns

- **Constant pool:** Store literal values (strings, compiled functions) in a separate array. Bytecode references them by index. Keeps instruction stream small and uniform.
- **Tail call optimization:** Detect `return f(args)` pattern, reuse the current stack frame instead of pushing a new one. Prevents stack overflow on recursive algorithms. In WASM: rewrite as loop + parameter reassignment.
- **Optimization pipeline:** Parse → AST → constant fold → dead code eliminate → type inference → compile → peephole optimize. Each pass is simple and composable. Constant folding on AST (`1 + 2` → `3`) is trivial but catches a lot.
- **String interning:** Deduplicate identical strings by storing them in a hash map. Compare by pointer instead of by content. Major performance win for hash map keys and identifier-heavy code.
- **Module system:** Export named bindings from one compilation unit, import in another. Requires a linking phase that resolves cross-module references.

## Pitfalls

- **WASM structured control flow:** No goto means loops and conditionals must be expressed with block/loop/br/br_if. Breaking out of nested loops requires multiple br depths. This is the hardest part of WASM code generation.
- **GC in WASM:** WASM has no built-in GC (yet, GC proposal is in progress). Had to implement mark-and-sweep manually: maintain a root set, trace reachable objects, free unreachable ones. The GC needs to know about ALL roots (stack, globals, temporaries).
- **Source maps for compiled code:** Map bytecode/WASM offsets back to source positions for error reporting. Need to carry position info through every compilation phase without losing it.
- **Peephole optimization correctness:** Pattern-matching on instruction sequences and replacing them. Easy to introduce bugs by matching too greedily or not accounting for side effects. Every optimization needs test coverage.

## Architecture Insight

The Monkey project proved that a full language implementation pipeline (lexer → parser → multiple backends) is tractable as a single-person project IF you build incrementally and test obsessively. 1496+ tests made it possible to refactor fearlessly. The test suite is the real product.

## Open Questions

- Register-based VM vs stack-based — does it matter in practice for a JS-hosted VM?
- SSA form for optimization passes — worth the complexity for a teaching language?
- WASM GC proposal — when it lands, how much of the manual GC can be removed?
