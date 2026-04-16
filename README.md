# Monkey-lang

A complete programming language implementation in JavaScript, featuring a full compiler pipeline from source code to multiple backends.

## Features

- **Lexer + Parser** → Rich AST with pattern matching, closures, loops, generators
- **Tree-walking Evaluator** → Direct interpretation
- **Bytecode Compiler + VM** → Stack-based virtual machine
- **WASM Backend** → Compile to WebAssembly
- **RISC-V Backend** → Compile to RISC-V assembly (with GC!)
- **Type System** → Hindley-Milner type inference (Algorithm W)
- **Optimization Pipeline** → SSA, constant propagation, dead code elimination
- **38 test files** → Comprehensive coverage

## Compiler Pipeline

```
Source Code
    │
    ▼
┌─────────┐    ┌──────────────┐    ┌──────────┐
│  Lexer  │ →  │    Parser    │ →  │   AST    │
└─────────┘    └──────────────┘    └──────────┘
                                        │
                    ┌───────────────────┬┴──────────────────┐
                    │                   │                    │
                    ▼                   ▼                    ▼
            ┌──────────────┐  ┌──────────────┐    ┌──────────────┐
            │ Type Checker │  │     CFG      │    │     DCE      │
            │ (Algorithm W)│  │ Basic Blocks │    │ Dead Code    │
            └──────┬───────┘  └──────┬───────┘    └──────────────┘
                   │                 │
                   ▼                 ▼
            ┌──────────────┐  ┌──────────────┐
            │  Type Info   │  │     SSA      │
            │ (LSP Hover)  │  │  (Cytron)    │
            └──────────────┘  └──────┬───────┘
                                     │
                    ┌────────────────┬┴──────────────────┐
                    │                │                    │
                    ▼                ▼                    ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │  Const Prop  │  │  Liveness    │  │   Escape     │
            │   (SCCP)     │  │  Analysis    │  │  Analysis    │
            └──────────────┘  └──────┬───────┘  └──────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Reg Alloc   │
                              │ Graph Color  │
                              └──────────────┘
                                     │
                    ┌────────────────┬┴──────────────────┐
                    │                │                    │
                    ▼                ▼                    ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │   RISC-V     │  │    WASM      │  │  Bytecode    │
            │  Codegen     │  │  Backend     │  │  Compiler    │
            └──────────────┘  └──────────────┘  └──────────────┘
```

## Module Catalog

### Frontend
| Module | File | Description |
|--------|------|-------------|
| Lexer | `src/lexer.js` | Tokenization |
| Parser | `src/parser.js` | Recursive descent, all expression types |
| AST | `src/ast.js` | Expression/Statement nodes |

### Type System
| Module | File | Description |
|--------|------|-------------|
| Type Checker | `src/typechecker.js` | Algorithm W, HM inference |
| Type Info | `src/type-info.js` | LSP-like hover (inferred types) |
| Type Tracer | `src/type-tracer.js` | Step-by-step inference visualization |

### Analysis
| Module | File | Description |
|--------|------|-------------|
| CFG | `src/cfg.js` | Basic blocks, dominators, loop detection, DOT export |
| SSA | `src/ssa.js` | Cytron algorithm, phi nodes, variable renaming |
| Constant Propagation | `src/const-prop.js` | SCCP, lattice-based analysis |
| Liveness | `src/liveness.js` | Backward dataflow, dead assignments |
| Dead Code Elimination | `src/dce.js` | Unreachable code, constant conditions |
| Escape Analysis | `src/escape.js` | Stack vs heap allocation decisions |
| Register Allocator | `src/regalloc.js` | Graph coloring (Chaitin-Briggs) + Linear scan |
| Pipeline | `src/pipeline.js` | Unified: all passes in sequence |

### Optimization
| Module | File | Description |
|--------|------|-------------|
| Typed Optimizer | `src/typed-optimizer.js` | Constant folding, strength reduction |
| Inline Caching | `src/shape.js` | V8-style shapes + IC |

### Backends
| Module | File | Description |
|--------|------|-------------|
| Evaluator | `src/evaluator.js` | Tree-walking interpreter |
| Bytecode Compiler | `src/compiler.js` | Stack-based bytecode |
| VM | `src/vm.js` | Virtual machine |
| WASM Backend | `src/wasm.js` | WebAssembly compilation |
| RISC-V Codegen | `../riscv-emulator/src/monkey-codegen.js` | RISC-V assembly |

### Testing
| File | Description |
|------|-------------|
| 38 test files | `src/*.test.js` |
| Parity tests | Evaluator ↔ VM equivalence |
| Integration | End-to-end compilation |
| Stress tests | Complex programs |

## Running

```bash
# REPL
node repl.js

# With type checking
node repl.js --typecheck

# Run all tests
for f in src/*.test.js; do node "$f"; done

# Run compiler pipeline on source
node -e "import {CompilerPipeline} from './src/pipeline.js'; const p = new CompilerPipeline(); console.log(p.run('let x = 5; let y = x + 1;').stats)"
```

## Language Features

- **Data types**: integers, strings, booleans, arrays, hashes, null
- **Functions**: first-class closures, recursion, default params
- **Control flow**: if/else, while, for-in, match/case
- **Operators**: arithmetic, comparison, string concat, logical
- **Built-ins**: puts, len, first, last, rest, push, type
- **Advanced**: generators (yield), try/catch, spread operator, destructuring
