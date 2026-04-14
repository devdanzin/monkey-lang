# Monkey Language 🐵

A feature-rich programming language interpreter written from scratch in JavaScript, based on Thorsten Ball's "Writing An Interpreter In Go" — then extended far beyond.

## Features

### Data Types
- **Integer**: `42`, `-7`
- **Float**: `3.14`, `1.5e10`
- **String**: `"hello"`, with escape sequences
- **Boolean**: `true`, `false`
- **Null**: `null`
- **Array**: `[1, 2, 3]`
- **Hash**: `{"key": "value", 1: true}`
- **Function**: first-class, closures

### Variables & Constants
```monkey
let x = 42;
const PI = 3.14159;       // immutable
let [a, b, c] = [1, 2, 3];           // array destructuring
const [x, y] = [10, 20];             // const destructuring
let {name, age} = {"name": "Alice", "age": 30};  // hash destructuring
```

### Functions
```monkey
// Regular functions
let add = fn(x, y) { x + y };

// Arrow functions (implicit return)
let double = fn(x) => x * 2;

// Default parameters
let greet = fn(name = "world") => f"hello {name}";

// Rest parameters
let sum = fn(...nums) { reduce(nums, 0, fn(a, x) => a + x) };

// Closures
let counter = fn() {
  let n = 0;
  fn() { n = n + 1; n }
};
```

### String Interpolation (F-strings)
```monkey
let name = "world";
f"hello {name}"           // → "hello world"
f"{2 + 3} items"          // → "5 items"
f"PI ≈ {3.14159}"         // → "PI ≈ 3.14159"
```

### Operators
```monkey
// Arithmetic: + - * / %
// Comparison: == != < > <= >=
// Logical: && || !
// Null coalescing: ??
// String repeat: "ha" * 3  → "hahaha"
// Range: 1..5             → [1, 2, 3, 4, 5]
// Pipe: x |> f            → f(x)
// Spread: [0, ...arr, 3]  → expanded array
```

### Method Syntax
```monkey
// Dot notation desugars to function calls
[1, 2, 3].len()              // → 3
[1, 2, 3].map(fn(x) => x * 2)   // → [2, 4, 6]
"hello".upper()               // → "HELLO"

// Chaining
[1,2,3,4,5]
  .filter(fn(x) => x > 2)
  .map(fn(x) => x * 10)
  .len()                      // → 3
```

### Array Comprehensions
```monkey
[x * 2 for x in [1, 2, 3]]              // → [2, 4, 6]
[x * x for x in 1..5]                    // → [1, 4, 9, 16, 25]
[x for x in 1..10 if x % 2 == 0]        // → [2, 4, 6, 8, 10]
```

### Pattern Matching
```monkey
let result = match status {
  "ok" => 200,
  "not_found" => 404,
  "error" => 500,
  _ => 0
};

// With type checking
match type(x) {
  "INTEGER" => f"number: {x}",
  "STRING" => f"string: {x}",
  _ => "other"
}
```

### Control Flow
```monkey
if (x > 0) { "positive" } else { "non-positive" }
while (n > 0) { n = n - 1; }
for (let i = 0; i < 10; i = i + 1) { puts(i); }
for (x in [1, 2, 3]) { puts(x); }
```

### Error Handling
```monkey
try {
  throw "something went wrong"
} catch (e) {
  f"caught: {e}"
}
```

### Built-in Functions

**Array**: `len`, `first`, `last`, `rest`, `push`, `map`, `filter`, `reduce`, `reverse`, `sort`, `flatten`, `zip`

**String**: `len`, `upper`, `lower`, `split`, `join`, `trim`, `replace`, `starts_with`, `ends_with`, `contains`, `slice`, `chars`

**Math**: `sqrt`, `pow`, `sin`, `cos`, `abs`, `floor`, `ceil`, `min`, `max`, `PI`, `E`

**I/O**: `puts`, `type`

### Compilation

Monkey includes a bytecode compiler and virtual machine:
```monkey
// Tree-walker interpreter (default)
monkeyEval(program, env)

// Bytecode compilation + VM execution
const compiler = new Compiler();
compiler.compile(program);
const vm = new VM(compiler.bytecode());
vm.run();
```

## Architecture

- **Lexer** (`lexer.js`): Tokenizer with support for all operators and literals
- **Parser** (`parser.js`): Pratt parser (top-down operator precedence)
- **AST** (`ast.js`): Expression and statement nodes
- **Evaluator** (`evaluator.js`): Tree-walking interpreter
- **Compiler** (`compiler.js`): Bytecode compiler
- **VM** (`vm.js`): Stack-based virtual machine
- **Object** (`object.js`): Runtime value types

## Tests

```bash
npm test  # 545+ tests
```

## Examples

```monkey
// FizzBuzz in one line
[if (x % 15 == 0) { "FizzBuzz" } else { if (x % 3 == 0) { "Fizz" } else { if (x % 5 == 0) { "Buzz" } else { x } } } for x in 1..15]

// Fibonacci
let fib = fn(n) => match n {
  0 => 0,
  1 => 1,
  _ => fib(n - 1) + fib(n - 2)
};

// Pipeline: sum of squares of even numbers 1-100
(1..100)
  .filter(fn(x) => x % 2 == 0)
  .map(fn(x) => x * x)
  .reduce(0, fn(a, x) => a + x)
```

## License

MIT
