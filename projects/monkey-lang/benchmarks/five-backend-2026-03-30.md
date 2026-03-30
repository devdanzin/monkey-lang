# Five-Backend Benchmark Results

**Date:** 2026-03-30
**Machine:** MacBook Pro (x64), Node.js v22.22.1
**Method:** Median of 5 runs

## Results

| Benchmark | Eval | VM | JIT | Transpiler | WASM | Fastest |
|-----------|-----:|---:|----:|-----------:|-----:|---------|
| fib(25) | 285ms | 97ms | 12ms | 1.9ms | 0.65ms | **WASM** |
| fib(30) | 3477ms | 903ms | 108ms | 21ms | 6.7ms | **WASM** |
| factorial(20) | 0.2ms | 0.5ms | 0.5ms | 0.0ms | N/A¹ | **Trans** |
| sum 10k | 12ms | 6ms | 1.3ms | 0.16ms | 0.07ms | **WASM** |
| sum 100k | 118ms | 57ms | 2.7ms | 0.12ms | N/A¹ | **Trans** |
| nested 100×100 | 12ms | 7ms | 1.8ms | 0.15ms | 0.14ms | **WASM** |
| GCD(48,18) ×1000 | 7ms | 27ms | 28ms | 0.12ms | 0.08ms | **WASM** |
| power(2,20) ×100 | 3ms | 1.6ms | 1.8ms | 0.11ms | 0.06ms | **WASM** |
| fn call 10k | 19ms | 10ms | 1.8ms | 0.38ms | 0.09ms | **WASM** |
| closure factory 5k | 10ms | 5ms | 1.5ms | N/A² | 0.09ms | **WASM** |
| higher-order 5k | 14ms | 6ms | 1.3ms | 0.05ms | 0.16ms | **Trans** |
| if/else 10k | 16ms | 8ms | 2.4ms | 0.12ms | 0.07ms | **WASM** |

¹ WASM uses i32 (32-bit integers), overflows on large values
² Transpiler doesn't support closures in this test

## Summary

| Comparison | Average Speedup |
|-----------|----------------:|
| WASM vs VM | **110x** |
| WASM vs JIT | **52x** |
| Transpiler vs VM | ~65x (where applicable) |
| JIT vs VM | **5.5x** |

**Wins:** WASM 9/12, Transpiler 3/12

## Architecture Notes

- **WASM** compiles to native WebAssembly, executed by V8's WASM engine. Near-native speed.
- **Transpiler** generates JavaScript that V8 optimizes with TurboFan. Very fast for simple programs.
- **JIT** records execution traces and compiles hot loops to JavaScript. ~5x over VM.
- **VM** is a stack-based bytecode interpreter. ~2-3x over tree-walking eval.
- **Eval** is a tree-walking interpreter. Slowest but most complete.

The WASM backend's advantage comes from ahead-of-time compilation to a typed, low-level format that maps directly to machine instructions. No dynamic dispatch, no boxing/unboxing, no garbage collector pauses.
