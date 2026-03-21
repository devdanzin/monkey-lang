---
uses: 1
created: 2026-03-20
last-used: 2026-03-20
topics: compiler,vm
---
# Compiler & Stack VM Design

Lessons from building a bytecode compiler + stack VM for the Monkey language.

## Architecture
- **Compiler**: walks AST, emits bytecode instructions into a flat byte array
- **VM**: executes bytecode with a stack, constant pool, and global store
- **Symbol table**: tracks variable scopes (global/local/builtin/free/function) for correct load/store opcodes

## Key Insights

### Compilation Scopes
Functions compile into their own scope — the compiler pushes a new "compilation scope" when entering a function literal, emits bytecode into it, then pops it and wraps the result as a CompiledFunction constant. This naturally handles nested functions.

### Closures & Free Variables
The symbol table detects when a variable reference crosses scope boundaries. When resolving a symbol that's not in the current scope, it walks up and marks it as "free" in each intermediate scope. The compiler emits `OpGetFree` instructions, and the VM creates Closure objects that capture these free variables at function-creation time.

### Stack vs Register VM
Stack VMs are simpler to implement (no register allocation). Every operation pops operands and pushes results. The tradeoff is more instructions (push/pop overhead), but for a learning project this is the right call. Real-world: CPython and JVM are stack-based; Lua 5+ and LuaJIT are register-based.

### The instanceof Gotcha
When creating objects in the compiler/VM, always use proper constructor types (MonkeyInteger, MonkeyString, etc.) — not plain JS objects. VM code often uses `instanceof` checks for type dispatch, and plain objects will silently fail those checks.

### Jump Patching
Conditionals (if/else) emit jump instructions with placeholder operands, then patch them after compiling the consequence/alternative blocks. Key: track the position of the jump instruction when you emit it, then overwrite the operand bytes once you know the target.

### Test Strategy
Test with nested expressions first — they catch most precedence and scope bugs. Recursive functions (fibonacci) are the best single test for closures + call frames working correctly.

## Optimization Opportunities (from evening research)

See `lessons/dispatch-strategies.md` and `lessons/vm-internals-lua-cpython.md` for full details.

**Priority order for Monkey VM (JS-hosted, so no computed gotos/JIT):**
1. **Specialized arithmetic opcodes** — highest impact. `OpAddInt`, `OpSubInt`, etc. skip type dispatch for the common integer case. Guard on type, fallback to generic. Even a simple `typeof` fast-path in existing handlers helps.
2. **Constant-operand opcodes** — `OpAddConst`, `OpSubConst`. Eliminates one stack push+pop per op. Lua does this extensively (OP_ADDK, OP_ADDI).
3. **Superinstructions** — combine hot opcode pairs (e.g., `OpConstant`+`OpAdd` → `OpAddConst`). Profile bytecode, implement top 5 pairs. ~10-15% dispatch reduction.
4. **Inline fast-path** — not even new opcodes, just early type checks in existing handlers before full object dispatch.

**Key insight from Lua comparison:** Lua's register VM uses ~8 instructions for fib() vs CPython's ~17 (stack VM). Dispatch is the bottleneck, so fewer instructions wins. For Monkey, reducing instruction count via constant operands and superinstructions is more impactful than reducing per-instruction cost.

## What's Missing (next steps)
- ~~BUG: Recursive closures in local scope~~ **FIXED 2026-03-20**: In `LetStatement` compilation, set `node.value.name` on function literals before compiling. This triggers `defineFunctionName()` inside `compileFunctionLiteral`, creating a FUNCTION-scoped symbol that resolves to `OpCurrentClosure` instead of incorrectly resolving as a free variable. Key insight: `define()` the local slot *before* setting the name, so the slot is reserved for external callers, but the function body's self-reference uses `OpCurrentClosure`.
- Opcode specialization for arithmetic (see optimization section above)
- Constant-operand opcodes
- String operations, more builtins, module system

## Performance
- VM is ~2x faster than interpreter on compute-heavy workloads (fib(25): 83ms vs 166ms)
- Small workloads show no speedup (overhead dominates at <2ms)
- Compilation cost is negligible vs execution for meaningful programs
