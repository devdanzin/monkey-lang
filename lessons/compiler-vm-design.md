# Compiler & Stack VM Design (Monkey Language)

Promoted from `memory/scratch/compiler-vm.md` (2 uses across 2026-03-20, 2026-03-21).

## Architecture

Compiler walks AST → emits bytecode into flat byte array. VM executes with a stack, constant pool, and global store. Symbol table tracks scopes (global/local/builtin/free/function).

## Key Lessons

### Compilation Scopes
Functions compile into their own scope. Push a new "compilation scope" on function entry, emit into it, pop and wrap as CompiledFunction constant. Handles nested functions naturally.

### Closures & Free Variables
When resolving a symbol not in current scope, walk up and mark "free" in each intermediate scope. Compiler emits `OpGetFree`. VM creates Closure objects that capture free variables at function-creation time.

### Recursive Closures (Gotcha!)
In `LetStatement`, set `node.value.name` on function literals **before** compiling the body. This triggers `defineFunctionName()`, creating a FUNCTION-scoped symbol that resolves to `OpCurrentClosure` instead of incorrectly resolving as a free variable. Define the local slot *before* setting the name so the slot is reserved for external callers.

### Stack vs Register VM
Stack VMs: simpler (no register allocation), but more instructions (push/pop overhead). CPython, JVM = stack. Lua 5+, LuaJIT = register. For learning projects, stack is the right call.

### Jump Patching
Conditionals emit jumps with placeholder operands, then patch after compiling consequence/alternative. Track the position when emitting, overwrite operand bytes when target is known.

### instanceof Gotcha
Always use proper constructor types (MonkeyInteger, MonkeyString, etc.) — never plain JS objects. VM type dispatch relies on `instanceof`, and plain objects silently fail.

### Test Strategy
Test with nested expressions first — they catch most precedence and scope bugs. Recursive fibonacci is the best single test for closures + call frames working correctly.

## Performance Baseline
- VM is ~2x faster than tree-walking evaluator on compute-heavy work
- fib(25): ~80ms (VM with optimizations) vs ~166ms (eval)
- Small workloads (<2ms) show no speedup — overhead dominates
- Compilation cost is negligible vs execution for meaningful programs
