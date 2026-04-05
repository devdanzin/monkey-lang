# bytecode-vm ⚙️

A stack-based bytecode virtual machine with a complete pipeline: source code → tokens → AST → bytecode → execution.

## The Language

A simple functional expression language:

```
// Arithmetic
(2 + 3) * 4 - 1  // → 19

// Let bindings
let x = 10 in let y = 20 in x + y  // → 30

// Conditionals
if 3 < 5 then "yes" else "no"  // → "yes"

// Functions (lambdas)
let double = fn x -> x * 2 in double(21)  // → 42

// Arrays
let xs = [1, 2, 3, 4, 5] in xs[2]  // → 3

// Built-ins
len([1, 2, 3])     // → 3
push([1, 2], 3)    // → [1, 2, 3]
len("hello")       // → 5

// Complex program
let xs = [1, 2, 3, 4, 5] in
let n = len(xs) in
if n > 3 then xs[0] + xs[4] else 0  // → 6
```

## Architecture

```
Source Code → Tokenizer → Parser → AST → Compiler → Bytecode → VM → Result
```

```
src/
├── index.js         — Op codes, Chunk, VM, Compiler
├── parser.js        — Tokenizer + recursive descent parser
├── index.test.js    — 77 VM + Compiler tests
└── parser.test.js   — 44 parser + integration tests
```

**121 tests total, all passing.**

## Pipeline

### 1. Tokenizer
Converts source to tokens: numbers, strings, identifiers, operators, keywords.
```javascript
tokenize('let x = 42 in x + 1')
// → [LET, IDENT:x, ASSIGN, NUMBER:42, IN, IDENT:x, PLUS, NUMBER:1, EOF]
```

### 2. Parser
Recursive descent parser with proper operator precedence:
- Precedence: `||` < `&&` < comparison < `+/-` < `*/%` < unary < postfix
- Constructs: `let`/`in`, `if`/`then`/`else`, `fn`/`->`, arrays, indexing, function calls

### 3. Compiler
AST → bytecode translation with:
- Constant pool for values
- Local variable slots
- Jump patching for conditionals
- Closure creation for lambdas

### 4. Virtual Machine
Stack-based execution with:
- Constant pool, stack, call frames
- Local variables via base pointer
- Closures with free variable capture
- Native function calls

## Opcodes

| Op | Args | Description |
|----|------|-------------|
| `CONST idx` | 1 | Push constant from pool |
| `ADD` | 0 | Pop 2, push sum |
| `SUB` | 0 | Pop 2, push difference |
| `MUL` | 0 | Pop 2, push product |
| `DIV` | 0 | Pop 2, push quotient (integer) |
| `MOD` | 0 | Pop 2, push remainder |
| `NEGATE` | 0 | Negate top |
| `EQ NE LT GT LE GE` | 0 | Comparison operators |
| `AND OR NOT` | 0 | Logical operators |
| `JUMP addr` | 1 | Unconditional jump |
| `JUMP_IF_FALSE addr` | 1 | Conditional jump |
| `LOAD idx` | 1 | Push local variable |
| `STORE idx` | 1 | Pop into local variable |
| `CALL nargs` | 1 | Call function |
| `RETURN` | 0 | Return from function |
| `CLOSURE addr nfree` | 2 | Create closure |
| `GET_FREE idx` | 1 | Get captured variable |
| `ARRAY n` | 1 | Create array from n stack values |
| `INDEX` | 0 | Array/string indexing |
| `SET_INDEX` | 0 | Immutable array update |
| `LEN` | 0 | Length of array/string |
| `PUSH` | 0 | Append to array |
| `CONCAT` | 0 | Join arrays or strings |
| `SLICE` | 0 | Extract sub-array/string |
| `DUP` | 0 | Duplicate top of stack |
| `POP` | 0 | Discard top |
| `PRINT` | 0 | Print top |
| `HALT` | 0 | Stop execution |

## Usage

### From Source Code
```javascript
import { run } from './src/parser.js';

run('let x = 10 in x * x');  // → 100
run('[1, 2, 3][1]');          // → 2
run('if true then 42 else 0'); // → 42
```

### Programmatic API
```javascript
import { Op, Chunk, VM, Compiler, evaluate } from './src/index.js';

// Build bytecode manually
const chunk = new Chunk();
chunk.emit(Op.CONST, chunk.addConstant(6));
chunk.emit(Op.CONST, chunk.addConstant(7));
chunk.emit(Op.MUL);
chunk.emit(Op.HALT);
new VM(chunk).run(); // → 42

// Or use the AST compiler
evaluate({ tag: 'binop', op: '*', left: { tag: 'lit', value: 6 }, right: { tag: 'lit', value: 7 } });
// → 42

// Inspect bytecode
console.log(chunk.disassemble());
//    0: CONST 0
//    2: CONST 1
//    4: MUL
//    5: HALT
```

## Tests

```bash
node --test src/*.test.js
```

## Design Decisions

- **Stack-based** — Simpler than register-based, easier to compile to
- **Immutable arrays** — `SET_INDEX` and `PUSH` return new arrays
- **Integer division** — `DIV` truncates (like Python's `//`)
- **Closures** — Full closure support with free variable capture
- **Max steps** — Execution limited to 100K steps (infinite loop protection)

## Known Limitations

- Closures don't properly capture outer function parameters (shallow only)
- No loops (use recursion + if/else)
- No multi-argument functions (use currying: `fn x -> fn y -> x + y`)
- No mutation (all values immutable)
- No garbage collection

## License

MIT
