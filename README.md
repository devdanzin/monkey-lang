# 🐒 Monkey-lang

A feature-rich programming language with a bytecode compiler, virtual machine, garbage collector, debugger, and optimizer.

## Features

- **Types**: Integers, floats, booleans, strings, arrays, hashes, null
- **Variables**: `let`, `const`, `set` (mutation)
- **Functions**: First-class, closures, recursion, tail call optimization
- **Default parameters**: `fn(x, y = 10) { ... }`
- **Rest parameters**: `fn(first, ...rest) { ... }`
- **Loops**: `for (x in arr)`, `while`, `do-while`
- **Array comprehensions**: `[x * 2 for x in arr if x > 0]`
- **Spread operator**: `[...a, ...b]`
- **Destructuring**: `let [a, b] = arr`, `let {x, y} = hash`
- **Pattern matching**: `match expr { pattern => body, _ => default }`
- **Deep equality**: `[1, 2, 3] == [1, 2, 3]` → `true`
- **F-strings**: `f"Hello {name}!"`
- **Pipe operator**: `x |> f`
- **Range syntax**: `1..10`
- **Range slicing**: `arr[1..3]`, `"hello"[0..2]`
- **Exponentiation**: `2 ** 10`
- **Optional chaining**: `x?.y`
- **Ternary**: `x ? a : b`
- **40+ built-in functions**

## Infrastructure

- **Bytecode compiler** with constant folding
- **Stack-based VM** with 30+ opcodes
- **Mark-sweep GC** with generational mode
- **Bytecode optimizer**: dead code elimination, peephole, jump threading
- **Bytecode debugger**: step, breakpoints, trace, inspection
- **Heap visualization**: DOT graph output
- **REPL**: Interactive + eval mode
- **Benchmark suite**

## Quick Start

```bash
# Evaluate an expression
node repl.js --eval "2 ** 10"
# 1024

# Interactive REPL
node repl.js

# Run benchmarks
node bench.js

# Run tests (807 tests)
node --test src/*.test.js
```

## Examples

```
// Fibonacci
let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
fib(20)  // 6765

// Closures with mutable state
let make_counter = fn() {
  let n = 0;
  let inc = fn() { set n = n + 1; n };
  inc
};
let counter = make_counter();
counter()  // 1
counter()  // 2

// Array comprehension with filter
let evens = [x for x in 1..20 if x % 2 == 0];
// [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]

// Pattern matching with deep equality
match [1, 2, 3] {
  [1, 2, 3] => "triple",
  [1, 2] => "pair",
  _ => "other"
}
// "triple"

// Default + rest parameters
let format = fn(sep = ", ", ...items) {
  join([str(x) for x in items], sep)
};
format(" | ", 1, 2, 3)  // "1 | 2 | 3"

// Spread operator
let a = [1, 2, 3];
let b = [0, ...a, 4];  // [0, 1, 2, 3, 4]

// Hash destructuring
let {name, age} = {"name": "Alice", "age": 30};
f"{name} is {age}"  // "Alice is 30"

// Range slicing
"hello"[1..3]       // "ell"
[10,20,30,40][1..2] // [20, 30]

// Pipe + match
5 |> fn(n) { match n % 2 { 0 => "even", _ => "odd" } }
// "odd"
```

## Tests

807 tests across 23 test files covering every feature.

```bash
node --test src/*.test.js
```
