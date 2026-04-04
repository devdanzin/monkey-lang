# wasm-interpreter

A WebAssembly interpreter built from scratch in JavaScript — binary decoder + stack machine executor.

Zero dependencies. Pure JavaScript. Interprets real `.wasm` binaries.

## Features

### Binary Decoder
- Full WASM binary format parsing (magic, version, all 12 section types)
- LEB128 unsigned/signed integer decoding
- Complete instruction set decoding (120+ opcodes)
- Type, function, table, memory, global, export, import, element, code, data sections

### Stack Machine
- Operand stack execution
- Full control flow: `block`, `loop`, `if/else`, `br`, `br_if`, `br_table`, `return`
- Function calls (direct + indirect via table)
- Locals and globals
- All i32 arithmetic: add, sub, mul, div, rem, and, or, xor, shifts, rotations
- All i32 comparisons: eq, ne, lt, gt, le, ge (signed + unsigned)
- f64 arithmetic and comparisons
- Memory: load, store (8/16/32-bit), grow, size
- Data segment initialization
- Import system (host functions)
- Traps (unreachable, divide by zero, out of bounds)

### Integration
- Compile-and-run pipeline: encode → decode → execute
- Compatible with Monkey language WASM compiler output
- Host function imports for I/O

## Usage

```javascript
import { instantiate } from './src/runtime.js';
import { buildModule, Op, encodeI32 } from './src/encoder.js';

// Build a simple WASM module
const wasm = buildModule({
  types: [{ params: ['i32', 'i32'], results: ['i32'] }],
  functions: [{
    typeIdx: 0,
    body: [Op.local_get, 0, Op.local_get, 1, Op.i32_add]
  }],
  exports: [{ name: 'add', kind: 'func', index: 0 }]
});

// Instantiate and run
const instance = instantiate(wasm);
console.log(instance.exports.add(2, 3)); // 5
```

### With imports

```javascript
const instance = instantiate(wasm, {
  env: {
    log: (value) => console.log(value),
    memory: new ArrayBuffer(65536),
  }
});
```

### WASI Support

```bash
# Run a WASI program
node src/cli.js program.wasm arg1 arg2

# Just decode (inspect module)
node src/cli.js program.wasm --decode

# With timing stats
node src/cli.js program.wasm --stats
```

## Architecture

```
.wasm binary
    │
    ▼
┌──────────┐     ┌─────────────┐
│  Decoder │────▶│   Module     │
│ (LEB128, │     │ (types,      │
│  sections)│     │  functions,  │
└──────────┘     │  memory...)  │
                 └──────┬──────┘
                        │
                        ▼
                 ┌─────────────┐
                 │  Runtime     │
                 │ (stack,      │
                 │  locals,     │
                 │  control flow)│
                 └─────────────┘
```

## Test Summary

| Module | Tests | Description |
|--------|-------|-------------|
| Decoder | 30 | Binary format parsing, LEB128, all section types |
| Runtime | 40 | Stack machine, control flow, arithmetic, memory |
| Integration | 8 | End-to-end programs: fibonacci, sort, mutual recursion |
| WASI | 10 | fd_write/read, args, environ, proc_exit, clock |
| CLI | 5 | File loading, decode mode, WASI execution |
| **Total** | **93** | |

## Programs Tested

- Fibonacci (recursive + iterative)
- Factorial (iterative)
- Sum 1-100
- GCD (Euclidean algorithm)
- Power function
- Bubble sort (in-memory array)
- Mutual recursion (isEven/isOdd)
- Host function I/O
- Memory read/write patterns

## Running Tests

```bash
node --test
```

## Design Decisions

1. **Exception-based control flow**: Branch and return signals use thrown objects (BranchSignal/ReturnSignal), keeping the instruction dispatch simple while correctly handling arbitrary nesting depth.

2. **Block extraction**: When encountering a structured control instruction (block/loop/if), the interpreter extracts the contained instructions into a sub-array and recursively executes them. This avoids maintaining a complex IP-based jump table.

3. **No validation pass**: The interpreter trusts the binary is well-formed (as a real WASM engine would validate separately). This keeps the code focused on execution semantics.

4. **JavaScript number semantics**: i32 operations use `| 0` and `>>> 0` to simulate 32-bit integer behavior. This matches how V8 handles WASM i32 internally.
