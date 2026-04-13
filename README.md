# 🐵 Monkey Language

A complete implementation of the Monkey programming language with **dual execution engines**: a tree-walking interpreter and a bytecode compiler + stack virtual machine.

Built from the ground up in JavaScript, inspired by Thorsten Ball's "Writing An Interpreter In Go" and "Writing A Compiler In Go", with significant extensions beyond the books.

## Features

### Language
- Integer, string, boolean, and null types
- First-class functions with closures
- Arrays and hash maps
- Recursive functions (fibonacci, ackermann, etc.)
- `while` loops and C-style `for` loops
- `set` statement for variable mutation
- Alphanumeric identifiers (`count1`, `myVar2`)
- Built-in functions: `len`, `first`, `last`, `rest`, `push`, `puts`

### Dual Execution Engines

**Tree-Walking Interpreter** — Direct AST evaluation with environments
```
Source → Lexer → Parser → AST → Evaluator → Result
```

**Bytecode Compiler + Stack VM** — Compiles to bytecode, then executes
```
Source → Lexer → Parser → AST → Compiler → Bytecode → VM → Result
```

The VM is **~2.5x faster** than the tree-walker for compute-heavy workloads (fibonacci, recursive patterns).

### Compiler Optimizations
- **Tail Call Optimization (TCO)**: Peephole optimization replaces `OpCall + OpReturnValue` with `OpTailCall + OpReturnValue`. The VM reuses the current stack frame for tail calls, enabling unlimited recursion depth.
  - Before TCO: `sum(5000, 0)` → stack overflow
  - After TCO: `sum(100000, 0)` = 5,000,050,000 in 71ms with constant stack usage
- **Integer Caching**: Pre-allocated `MonkeyInteger` objects for values -1 through 256, reducing GC pressure for common arithmetic.
- **Closure Compilation**: Free variables captured at compile time with proper scoping. Recursive functions use `defineFunctionName` for self-reference.

### Bytecode Instruction Set
30 opcodes covering:
- Constants, arithmetic (`+`, `-`, `*`, `/`), comparisons (`==`, `!=`, `>`, `<`)
- Booleans, null, prefix operators (`!`, `-`)
- Conditional/unconditional jumps
- Global and local variable bindings
- Arrays, hashes, index expressions
- Function calls, returns, closures, free variables
- Tail calls, builtins, `while` loops

## Quick Start

```bash
# Run the REPL (default: compiler+VM engine)
node src/repl.js

# Use the tree-walking interpreter
node src/repl.js --engine=interpreter

# Compare both engines side-by-side
node src/repl.js --engine=both

# Run tests
npm test

# Run benchmarks
node src/benchmark.js
```

## Example Programs

```monkey
// Recursive fibonacci
let fibonacci = fn(n) {
  if (n < 2) { return n }
  fibonacci(n - 1) + fibonacci(n - 2)
};
fibonacci(10) // → 55

// Higher-order functions
let map = fn(arr, f) {
  if (len(arr) == 0) { return [] }
  let iter = fn(arr, acc) {
    if (len(arr) == 0) { return acc }
    iter(rest(arr), push(acc, f(first(arr))))
  };
  iter(arr, [])
};
map([1, 2, 3, 4, 5], fn(x) { x * 2 }) // → [2, 4, 6, 8, 10]

// Closures
let newAdder = fn(x) { fn(y) { x + y } };
let addFive = newAdder(5);
addFive(3) // → 8

// Tail-recursive sum (works thanks to TCO!)
let sum = fn(n, acc) {
  if (n == 0) { return acc }
  sum(n - 1, acc + n)
};
sum(100000, 0) // → 5000050000 (no stack overflow)

// Imperative with set + for loop
let result = 1;
for (let i = 1; i < 6; set i = i + 1) {
  set result = result * i;
}
result // → 120 (factorial of 5)

// While loop with mutation
let fib1 = 0;
let fib2 = 1;
let count = 0;
while (count < 10) {
  let temp = fib2;
  set fib2 = fib1 + fib2;
  set fib1 = temp;
  set count = count + 1;
}
fib2 // → 89 (11th fibonacci number)
```

## Architecture

```
src/
├── lexer.js          # Tokenizer (source → tokens)
├── parser.js         # Pratt parser (tokens → AST)
├── ast.js            # AST node definitions
├── object.js         # Runtime object system (MonkeyInteger, MonkeyString, etc.)
├── evaluator.js      # Tree-walking interpreter
├── code.js           # Bytecode instruction set (30 opcodes)
├── compiler.js       # AST → bytecode compiler + symbol table
├── vm.js             # Stack virtual machine (bytecode executor)
├── repl.js           # Interactive REPL with --engine flag
└── benchmark.js      # Performance comparison (tree-walker vs VM)
```

## Test Suite

**294 tests** across all modules:
- Lexer tests (tokenization)
- Parser tests (AST construction)
- Evaluator tests (tree-walker correctness)
- Code tests (bytecode encoding/decoding)
- Compiler tests (AST → bytecode)
- VM tests (bytecode execution)
- **Parity tests** (84 tests verifying both engines produce identical results)
- Stress tests (deep recursion, large data structures, many closures)
- While loop tests

```bash
npm test
```

## Benchmarks

| Benchmark | Tree-Walker | VM | Speedup |
|-----------|------------|-----|---------|
| fibonacci(25) | 220ms | 87ms | 2.5x |
| fibonacci(30) | 2322ms | 1131ms | 2.1x |
| Sum 1..100 | 0.1ms | 0.1ms | ~1x |

The VM wins decisively on compute-heavy recursive workloads. For trivial programs, compilation overhead makes both engines similar.

## Language Extensions Beyond Standard Monkey

1. **While loops**: `while (condition) { body }` — compiled to bytecode jump loops
2. **For loops**: `for (let i = 0; i < 10; set i = i + 1) { body }` — C-style iteration
3. **Set statement**: `set x = expr` — mutate existing variable bindings
4. **Alphanumeric identifiers**: `count1`, `myVar2`, `player1Score` — digits allowed after first char
5. **Tail call optimization**: Automatic for tail-recursive functions
6. **String comparisons**: `==`, `!=`, `<`, `>` work on strings (lexicographic)
7. **Interactive REPL** with engine selection and persistent globals

## License

MIT
