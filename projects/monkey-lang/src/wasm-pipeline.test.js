import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileAndRun } from './wasm-compiler.js';

describe('WASM Optimization Pipeline', () => {
  it('runs with optimize: true', async () => {
    const result = await compileAndRun('2 + 3', { optimize: true });
    assert.equal(result, 5);
  });

  it('constant folding produces correct results', async () => {
    const result = await compileAndRun('(2 + 3) * 4', { optimize: true });
    assert.equal(result, 20);
  });

  it('string constant folding', async () => {
    const output = [];
    await compileAndRun('puts("hello" + " world")', { optimize: true, outputLines: output });
    assert.equal(output[0], 'hello world');
  });

  it('dead code elimination after return', async () => {
    const result = await compileAndRun(`
      let f = fn() {
        return 42;
        return 99;
      };
      f()
    `, { optimize: true });
    assert.equal(result, 42);
  });

  it('if(true) branch elimination', async () => {
    const result = await compileAndRun(`
      if (true) { 42 } else { 99 }
    `, { optimize: true });
    assert.equal(result, 42);
  });

  it('complex program with optimizations', async () => {
    const result = await compileAndRun(`
      let base = 10 * 10;
      let f = fn(x) { x + base };
      f(5)
    `, { optimize: true });
    assert.equal(result, 105);
  });

  it('optimization with GC enabled', async () => {
    const result = await compileAndRun(`
      let a = [1, 2, 3];
      a[1]
    `, { optimize: true, gc: true });
    assert.equal(result, 2);
  });

  it('type checking produces warnings', async () => {
    const warnings = [];
    await compileAndRun('let s = "hello"; s - 1', { 
      optimize: true, typeCheck: true, warnings 
    });
    assert.ok(warnings.length > 0, 'Should produce type warning');
  });

  it('closures work with optimizations', async () => {
    const result = await compileAndRun(`
      let makeAdder = fn(x) { fn(y) { x + y } };
      let add10 = makeAdder(5 + 5);
      add10(3)
    `, { optimize: true });
    assert.equal(result, 13);
  });

  it('loops work with optimizations', async () => {
    const result = await compileAndRun(`
      let sum = 0;
      for (let i = 0; i < 10; i = i + 1) {
        sum = sum + i;
      }
      sum
    `, { optimize: true });
    assert.equal(result, 45);
  });

  it('timings include optimize phase', async () => {
    const timings = {};
    await compileAndRun('1 + 2', { optimize: true, timings });
    assert.ok(timings.optimize >= 0, 'Should have optimize timing');
  });

  it('hash maps work with optimizations', async () => {
    const result = await compileAndRun(`
      let h = {1: 100, 2: 200};
      h[1] + h[2]
    `, { optimize: true });
    assert.equal(result, 300);
  });

  it('recursive function with optimizations', async () => {
    const result = await compileAndRun(`
      let fib = fn(n) {
        if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
      };
      fib(10)
    `, { optimize: true });
    assert.equal(result, 55);
  });
});
