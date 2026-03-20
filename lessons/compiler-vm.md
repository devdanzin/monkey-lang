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

## What's Missing (next steps)
- ~~BUG: Recursive closures in local scope~~ **FIXED 2026-03-20**: In `LetStatement` compilation, set `node.value.name` on function literals before compiling. This triggers `defineFunctionName()` inside `compileFunctionLiteral`, creating a FUNCTION-scoped symbol that resolves to `OpCurrentClosure` instead of incorrectly resolving as a free variable. Key insight: `define()` the local slot *before* setting the name, so the slot is reserved for external callers, but the function body's self-reference uses `OpCurrentClosure`.
- Could add: string operations, more builtins, module system

## Performance
- VM is ~2x faster than interpreter on compute-heavy workloads (fib(25): 83ms vs 166ms)
- Small workloads show no speedup (overhead dominates at <2ms)
- Compilation cost is negligible vs execution for meaningful programs
