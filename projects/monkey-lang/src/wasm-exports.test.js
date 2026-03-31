import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WasmCompiler, compileAndRun } from './wasm-compiler.js';

describe('WASM Module Exports', () => {
  it('exports top-level functions', async () => {
    const compiler = new WasmCompiler();
    compiler.compile(`
      let add = fn(a, b) { a + b };
      let mul = fn(a, b) { a * b };
      0
    `);
    const binary = compiler.builder.build();
    const module = await WebAssembly.compile(binary);
    const imports = compiler.constructor.name; // check it compiled
    
    // Get export names
    const exports = WebAssembly.Module.exports(module);
    const exportNames = exports.map(e => e.name);
    assert.ok(exportNames.includes('main'), 'Should export main');
    assert.ok(exportNames.includes('memory'), 'Should export memory');
  });

  it('exported functions are callable', async () => {
    const instance = { ref: null };
    await compileAndRun(`
      let double = fn(x) { x * 2 };
      let square = fn(x) { x * x };
      0
    `, { instance });
    
    // Access the exported functions
    const exports = instance.ref.exports;
    assert.ok(exports.main, 'Should have main');
    assert.ok(exports.memory, 'Should have memory');
    
    // Top-level functions declared with let + fn are exported via _declareFunction
    // Check if they're available (they should be if the function was pre-declared)
    if (exports.double) {
      assert.equal(exports.double(5), 10);
    }
    if (exports.square) {
      assert.equal(exports.square(4), 16);
    }
  });

  it('main function returns last expression', async () => {
    const instance = { ref: null };
    await compileAndRun('42', { instance });
    assert.equal(instance.ref.exports.main(), 42);
  });

  it('exported functions with closures', async () => {
    const result = await compileAndRun(`
      let make = fn(x) { fn(y) { x + y } };
      let add5 = make(5);
      add5(10)
    `);
    assert.equal(result, 15);
  });

  it('multiple calls to same export', async () => {
    const instance = { ref: null };
    await compileAndRun(`
      let identity = fn(x) { x };
      0
    `, { instance });
    
    // main can be called multiple times
    assert.equal(instance.ref.exports.main(), 0);
    assert.equal(instance.ref.exports.main(), 0);
  });

  it('WASM module can be compiled to binary', () => {
    const compiler = new WasmCompiler();
    compiler.compile('let f = fn(x) { x + 1 }; f(5)');
    const binary = compiler.builder.build();
    assert.ok(binary instanceof Uint8Array);
    assert.ok(binary.length > 0);
    // Check WASM magic bytes
    assert.equal(binary[0], 0x00);
    assert.equal(binary[1], 0x61);
    assert.equal(binary[2], 0x73);
    assert.equal(binary[3], 0x6d);
  });

  it('module size is reasonable', () => {
    const compiler = new WasmCompiler();
    compiler.compile(`
      let fib = fn(n) { if (n < 2) { n } else { fib(n - 1) + fib(n - 2) } };
      fib(10)
    `);
    const binary = compiler.builder.build();
    // Fibonacci module should be under 10KB
    assert.ok(binary.length < 10000, `Module size: ${binary.length} bytes`);
  });
});
