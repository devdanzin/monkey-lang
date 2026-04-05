# Forth Interpreter

A complete Forth interpreter built from scratch in JavaScript. Implements the core of the Forth language: stack-based computation, a threaded dictionary, compile/interpret modes, and defining words.

## Features

### Core Language
- **Dual-stack architecture** — Data stack + return stack
- **Dictionary** — Linked-list word lookup with shadowing
- **Compile/interpret modes** — `:` switches to compile mode, `;` switches back
- **Linear memory** — `@`, `!`, `ALLOT`, `,` for direct memory access

### Arithmetic & Logic
- Basic: `+ - * / MOD /MOD NEGATE ABS MIN MAX`
- Shortcuts: `1+ 1- 2+ 2- 2* 2/`
- Bitwise: `AND OR XOR INVERT LSHIFT RSHIFT`
- Comparison: `= <> < > <= >= 0= 0< 0> 0<>`
- Boolean: `TRUE FALSE NOT`

### Stack Manipulation
- Basic: `DUP DROP SWAP OVER ROT -ROT`
- Advanced: `NIP TUCK 2DUP 2DROP 2SWAP 2OVER ?DUP DEPTH PICK ROLL`
- Return stack: `>R R> R@`

### Control Flow
- Conditionals: `IF ELSE THEN`
- Counted loops: `DO LOOP +LOOP I J LEAVE`
- Indefinite loops: `BEGIN UNTIL`, `BEGIN WHILE REPEAT`
- Case: `CASE OF ENDOF ENDCASE`
- Recursion: `RECURSE`

### Defining Words
- Colon definitions: `: name ... ;`
- Variables: `VARIABLE name` (creates word that pushes address)
- Constants: `n CONSTANT name`
- Values: `n VALUE name` / `n TO name`
- Create: `CREATE name` (allocates data space)
- `DOES>` — Define runtime behavior for CREATE'd words
- `DEFER` / `IS` — Forward-declared words
- `IMMEDIATE` — Make a word execute at compile time

### Metaprogramming
- `'` (tick) — Get execution token
- `EXECUTE` — Run execution token
- `[']` — Compile-time tick
- `POSTPONE` — Compile compilation semantics

### I/O & Strings
- Output: `.` `.S` `EMIT` `CR` `SPACE` `SPACES` `.R`
- Strings: `." ..."` `S"` `TYPE`
- Character: `CHAR` `[CHAR]`
- Base: `HEX` `DECIMAL`

### Introspection
- `WORDS` — List all defined words
- `SEE` — Decompile a word

## Usage

```javascript
const { Forth } = require('./forth.js');

const f = new Forth();

// Basic arithmetic
f.run('3 4 +');
console.log(f.getStack()); // [7]

// Define and use words
f.run(': SQUARE DUP * ;');
f.run('5 SQUARE');
console.log(f.getStack()); // [7, 25]

// Output
console.log(f.run('." Hello, Forth!" CR')); // "Hello, Forth!\n"
```

## Examples

### Fibonacci
```forth
: FIB DUP 1 <= IF DROP 1 ELSE DUP 1- RECURSE SWAP 2 - RECURSE + THEN ;
10 FIB .  \ prints 89
```

### FizzBuzz
```forth
: FIZZBUZZ
  16 1 DO
    I 15 MOD 0= IF ." FizzBuzz " ELSE
    I 3 MOD 0= IF ." Fizz " ELSE
    I 5 MOD 0= IF ." Buzz " ELSE
    I . THEN THEN THEN
  LOOP ;
```

### GCD (Euclidean algorithm)
```forth
: GCD BEGIN DUP WHILE TUCK MOD REPEAT DROP ;
48 18 GCD .  \ prints 6
```

### CREATE DOES> (defining defining words)
```forth
: CONST CREATE , DOES> @ ;
42 CONST ANSWER
ANSWER .  \ prints 42

: ARRAY CREATE CELLS ALLOT DOES> SWAP CELLS + ;
5 ARRAY NUMS
10 0 NUMS !
0 NUMS @ .  \ prints 10
```

## Tests

```bash
node --test forth.test.js   # 109 interpreter tests
node --test vm.test.js      # 29 VM tests
node bench.js               # Benchmark comparison
```

138 tests total covering arithmetic, stack ops, control flow, defining words, memory, strings, metaprogramming, bytecode compilation, and complex programs.

## Bytecode VM

The project includes a bytecode compiler and stack-based VM:

```javascript
const { BytecodeVM, BytecodeCompiler, OP } = require('./vm.js');

const vm = new BytecodeVM();
// ... load compiled words, execute bytecode
```

### Opcodes (50+)
- **Stack**: DUP, DROP, SWAP, OVER, ROT, NIP, TUCK, 2DUP, 2DROP, ?DUP, DEPTH, PICK
- **Arithmetic**: ADD, SUB, MUL, DIV, MOD, NEGATE, ABS, MIN, MAX, INC, DEC, MUL2, DIV2
- **Bitwise**: AND, OR, XOR, INVERT, LSHIFT, RSHIFT
- **Comparison**: EQ, NE, LT, GT, LE, GE, ZEQ, ZLT, ZGT, NOT
- **Control**: BRANCH, BRANCH0, CALL, RET, DO, LOOP, PLUSLOOP, I, J
- **Return stack**: TOR, RFROM, RAT
- **Memory**: STORE, FETCH, PSTORE
- **I/O**: DOT, EMIT, CR

### Benchmarks (Interpreter vs VM)

| Benchmark | Interpreter | Bytecode VM | Speedup |
|-----------|------------|-------------|---------|
| fib(25) × 3 | 411ms | 247ms | **1.7×** |
| sum(10000) × 100 | 235ms | 98ms | **2.4×** |

## Architecture

The interpreter has three main components:

1. **Outer interpreter** — Tokenizes input, looks up words, dispatches to interpret or compile mode
2. **Dictionary** — Array of word entries (name, code, flags). Words are functions that receive the Forth instance.
3. **Inner interpreter** (`_exec`) — Executes compiled code arrays. Each instruction is `{type, ...}` with types: `call`, `literal`, `branch`, `branch0`, `do`, `loop`, `plusloop`, `i`, `j`, `recurse`, `does>`.

### Compilation Model
Colon definitions (`: name ... ;`) compile words into arrays of instruction objects. Control flow words (IF, DO, BEGIN) are IMMEDIATE — they execute at compile time to emit branch instructions with forward/backward references.

### Memory Model
A flat `Int32Array` provides linear memory. `HERE` tracks the next free cell. `ALLOT` reserves space, `,` (comma) stores a value and advances `HERE`. Variables and CREATE'd words return addresses into this memory.

## Zero Dependencies
Pure JavaScript, no external packages. Works in Node.js and browsers.
