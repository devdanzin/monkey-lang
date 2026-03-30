// WASM Peephole Optimizer
// Optimizes at the FuncBodyBuilder instruction level.
// Operates on body.code (raw bytes) after all instructions are emitted
// but before encoding (before body.encode() is called).

import { Op } from './wasm.js';

// Peephole optimize doesn't work well on raw bytes due to variable-length
// operand encoding. Instead, we rely on compile-time optimizations
// (constant folding) in the compiler itself.
//
// Future: add an instruction-level IR for optimization passes.

export function peepholeOptimize(body) {
  // Currently a no-op — compile-time constant folding handles the main cases.
  // Peephole on raw bytes is error-prone with LEB128 operands.
  return 0;
}
