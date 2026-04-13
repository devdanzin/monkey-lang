# Monkey Language

A complete implementation of the Monkey programming language from [Writing An Interpreter In Go](https://interpreterbook.com/) and [Writing A Compiler In Go](https://compilerbook.com/), extended with many additional features.

**Two execution engines** — tree-walking interpreter and bytecode compiler+VM — with comprehensive parity testing.

## Features

### Core Language
- **Integers, Booleans, Strings, Arrays, Hash Maps** — all first-class values
- **Functions** — first-class with closures and recursive support
- **If/Else expressions** — `if (x > 5) { "big" } else { "small" }`
- **Let bindings** — `let x = 5;`
- **Return statements** — `return 42;`

### Extended Syntax
- **While loops** — `while (x < 10) { set x = x + 1; }`
- **For loops** — `for (let i = 0; i < 10; set i = i + 1) { ... }`
- **Do/While loops** — `do { ... } while (condition)`
- **Set (mutation)** — `set x = x + 1;`
- **Modulo operator** — `x % 2`
- **Comparison operators** — `<`, `>`, `<=`, `>=`, `==`, `!=`
- **Logical operators** — `&&` (short-circuit AND), `||` (short-circuit OR)
- **String indexing** — `"hello"[1]` → `"e"`
- **String escape sequences** — `\n`, `\t`, `\\`, `\"`
- **Break/Continue** — loop control flow (evaluator)
- **Alphanumeric identifiers** — `myVar2`, `is_valid`

### Builtins (19 total)
| Builtin | Description |
|---------|-------------|
| `len(x)` | Length of string or array |
| `first(arr)` | First element |
| `last(arr)` | Last element |
| `rest(arr)` | All but first element |
| `push(arr, val)` | Append to array (immutable) |
| `puts(...)` | Print to stdout |
| `type(x)` | Type name as string |
| `str(x)` | Convert to string |
| `int(x)` | Parse string to integer |
| `format(fmt, ...)` | Printf-style formatting |
| `range(n)` / `range(start, end, step)` | Generate integer array |
| `split(str, sep)` | Split string into array |
| `join(arr, sep)` | Join array into string |
| `trim(str)` | Strip whitespace |
| `upper(str)` / `lower(str)` | Case conversion |
| `keys(hash)` / `values(hash)` | Hash iteration |
| `sort(arr)` | Sort array (ascending) |
| `map(arr, fn)` | Transform elements (evaluator) |
| `filter(arr, fn)` | Filter elements (evaluator) |
| `reduce(arr, init, fn)` | Fold array (evaluator) |

### Compiler Optimizations
- **Tail Call Optimization** — `sum(100000, 0)` runs without stack overflow (71ms)
- **Integer Caching** — -1 to 256 cached, zero allocations for common values
- **Constant Folding** — `2 + 3` → `5` at compile time, including strings
- **Dead Code Elimination** — unreachable code after `return` removed

## Architecture

```
src/
├── lexer.js       # Tokenizer (238 lines)
├── parser.js      # Pratt parser (399 lines)
├── ast.js         # AST node definitions (232 lines)
├── evaluator.js   # Tree-walking interpreter (551 lines)
├── compiler.js    # AST → bytecode compiler (586 lines)
├── code.js        # Opcode definitions (175 lines)
├── vm.js          # Stack-based virtual machine (649 lines)
├── object.js      # Object system (122 lines)
└── repl.js        # Interactive REPL (119 lines)
```

**Total: ~5,500 lines** | **334 tests** | **31 opcodes**

## Quick Start

```javascript
import { Lexer } from './src/lexer.js';
import { Parser } from './src/parser.js';
import { Compiler } from './src/compiler.js';
import { VM } from './src/vm.js';

const input = `
let fibonacci = fn(n) {
  if (n <= 1) { return n; }
  fibonacci(n - 1) + fibonacci(n - 2);
};
fibonacci(10)
`;

const compiler = new Compiler();
compiler.compile(new Parser(new Lexer(input)).parseProgram());
const vm = new VM(compiler.bytecode());
vm.run();
console.log(vm.lastPoppedStackElem().inspect()); // 55
```

## Examples

```monkey
// FizzBuzz
for (let i = 1; i <= 20; set i = i + 1) {
  if (i % 15 == 0) { puts("FizzBuzz"); }
  else { if (i % 3 == 0) { puts("Fizz"); }
  else { if (i % 5 == 0) { puts("Buzz"); }
  else { puts(i); } } }
}

// Functional: sum of squares of evens
let result = reduce(
  map(filter(range(1, 11), fn(x) { x % 2 == 0 }), fn(x) { x * x }),
  0, fn(acc, x) { acc + x }
);
// result = 220

// Closures
let makeCounter = fn() {
  let count = 0;
  fn() { set count = count + 1; count }
};
let counter = makeCounter();
counter(); // 1
counter(); // 2

// String manipulation
let words = split("hello world foo", " ");
let upper_words = map(words, fn(w) { upper(w) });
join(upper_words, "-"); // "HELLO-WORLD-FOO"
```

## Tests

```bash
npm test
```

334 tests covering:
- Lexer (tokenization, keywords, operators)
- Parser (expressions, statements, precedence)
- Evaluator (all features, error handling)
- Compiler (bytecode generation, optimizations)
- VM (execution, stack management, closures)
- Parity (84 tests verifying both engines match)
- Builtins (32 tests, all with parity verification)
- Stress tests (deep recursion, large arrays, TCO)

## Performance

| Benchmark | Evaluator | VM |
|-----------|-----------|-----|
| fibonacci(35) | ~6s | ~2s |
| sum(100000, 0) with TCO | ∞ (stack overflow) | 71ms |
| Constant folding: 2+3 | runtime add | compile-time 5 |

## License

MIT
