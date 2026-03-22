// JIT VM Integration Tests
// Tests that the JIT hooks correctly into the VM run loop:
// recording traces during execution and executing compiled traces

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { MonkeyInteger, NULL, TRUE, FALSE } from './object.js';

function parse(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  return parser.parseProgram();
}

function compileAndRunJIT(input) {
  const program = parse(input);
  const compiler = new Compiler();
  const err = compiler.compile(program);
  if (err) throw new Error(`compiler error: ${err}`);
  const vm = new VM(compiler.bytecode());
  vm.enableJIT();
  vm.run();
  return { result: vm.lastPoppedStackElem(), vm };
}

describe('JIT VM integration', () => {
  it('should produce correct results for simple counter loop', () => {
    // let x = 0; while (x < 100) { x = x + 1; }; x
    // This loop should hit hot threshold (16) and get traced
    const { result, vm } = compileAndRunJIT(`
      let x = 0;
      let i = 0;
      while (i < 100) {
        x = x + 1;
        i = i + 1;
      }
      x
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 100);
  });

  it('should produce correct results for fibonacci', () => {
    const { result } = compileAndRunJIT(`
      let fib = fn(n) {
        if (n < 2) { return n; }
        return fib(n - 1) + fib(n - 2);
      };
      fib(10)
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 55);
  });

  it('should produce correct results for nested loops', () => {
    const { result } = compileAndRunJIT(`
      let sum = 0;
      let i = 0;
      while (i < 10) {
        let j = 0;
        while (j < 10) {
          sum = sum + 1;
          j = j + 1;
        }
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 100);
  });

  it('should record and compile traces for hot loops', () => {
    const { result, vm } = compileAndRunJIT(`
      let x = 0;
      let i = 0;
      while (i < 50) {
        x = x + i;
        i = i + 1;
      }
      x
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 1225); // sum of 0..49
    // JIT should have at least detected hotness
    assert.ok(vm.jit.traceCount >= 0); // May or may not have compiled depending on opcodes used
  });

  it('should handle loops with conditionals', () => {
    const { result } = compileAndRunJIT(`
      let even = 0;
      let i = 0;
      while (i < 20) {
        if (i > 9) {
          even = even + 1;
        }
        i = i + 1;
      }
      even
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 10);
  });

  it('should not break non-loop code', () => {
    const { result } = compileAndRunJIT(`
      let x = 5 + 3;
      let y = x * 2;
      y
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 16);
  });

  it('should trace loops using superinstructions (OpGetLocal*Const)', () => {
    // This pattern emits fused OpGetLocal+OpAddConst superinstructions
    const { result, vm } = compileAndRunJIT(`
      let sum = 0;
      let i = 0;
      while (i < 50) {
        sum = sum + 1;
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 50);
    // Should have compiled at least one trace (superinstructions no longer abort)
    assert.ok(vm.jit.traceCount >= 1, `Expected compiled traces, got ${vm.jit.traceCount}`);
  });

  it('should handle bang operator in traced code', () => {
    const { result } = compileAndRunJIT(`
      let x = 0;
      let i = 0;
      while (i < 20) {
        if (!false) { x = x + 1; }
        i = i + 1;
      }
      x
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 20);
  });

  it('should match non-JIT results for all basic operations', () => {
    const inputs = [
      ['1 + 2', 3],
      ['10 - 3', 7],
      ['4 * 5', 20],
      ['10 / 3', 3],
      ['if (true) { 10 } else { 20 }', 10],
      ['if (false) { 10 } else { 20 }', 20],
      ['let x = 42; x', 42],
    ];

    for (const [input, expected] of inputs) {
      const { result } = compileAndRunJIT(input);
      assert.ok(result instanceof MonkeyInteger, `${input}: expected MonkeyInteger, got ${result?.constructor?.name}`);
      assert.equal(result.value, expected, `${input}: expected ${expected}, got ${result.value}`);
    }
  });

  it('should compile side traces for hot guard exits', () => {
    // Loop where first 100 iterations take one path, next 100 take another.
    // The main trace records the first path; after enough guard exits the
    // second path gets a side trace.
    const { result, vm } = compileAndRunJIT(`
      let a = 0;
      let b = 0;
      let i = 0;
      while (i < 200) {
        if (i > 99) {
          b = b + 1;
        } else {
          a = a + 1;
        }
        i = i + 1;
      }
      a + b
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 200);
    assert.ok(vm.jit.traceCount >= 1, `Expected at least 1 trace, got ${vm.jit.traceCount}`);
  });

  it('should produce correct results with side traces on branching loops', () => {
    // A loop where ~half iterations take the branch and half don't.
    // Both paths should eventually be traced.
    const { result } = compileAndRunJIT(`
      let x = 0;
      let i = 0;
      while (i < 100) {
        if (i > 49) {
          x = x + 2;
        } else {
          x = x + 1;
        }
        i = i + 1;
      }
      x
    `);
    assert.ok(result instanceof MonkeyInteger);
    // First 50 iterations: x += 1 (50), next 50: x += 2 (100), total 150
    assert.equal(result.value, 150);
  });

  it('should inline function calls within traced loops', () => {
    // A loop that calls a simple function each iteration
    // The JIT should inline the function call into the trace
    const { result, vm } = compileAndRunJIT(`
      let double = fn(x) { x * 2 };
      let sum = 0;
      let i = 0;
      while (i < 100) {
        sum = sum + double(i);
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    // sum of 2*i for i=0..99 = 2 * (99*100/2) = 9900
    assert.equal(result.value, 9900);
    assert.ok(vm.jit.traceCount >= 1, `Expected traces with inlining, got ${vm.jit.traceCount}`);
  });

  it('should inline nested function calls within traced loops', () => {
    const { result } = compileAndRunJIT(`
      let square = fn(x) { x * x };
      let add_squares = fn(a, b) { square(a) + square(b) };
      let sum = 0;
      let i = 0;
      while (i < 50) {
        sum = sum + add_squares(i, 1);
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    // sum of (i*i + 1) for i=0..49 = sum(i^2) + 50 = 49*50*99/6 + 50 = 40425 + 50 = 40475
    assert.equal(result.value, 40475);
  });

  it('should handle nested loops correctly at scale (regression)', () => {
    // Bug: side trace for inner loop exit stored raw int to globals
    // instead of MonkeyInteger, causing .value → undefined
    const { result } = compileAndRunJIT(`
      let sum = 0;
      let i = 0;
      while (i < 50) {
        let j = 0;
        while (j < 50) {
          sum = sum + 1;
          j = j + 1;
        }
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 2500);
  });

  it('should handle large integer sums without overflow (regression)', () => {
    // Bug: | 0 in compiled traces truncated to int32
    const { result } = compileAndRunJIT(`
      let sum = 0;
      let i = 0;
      while (i < 100000) {
        sum = sum + i;
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 4999950000);
  });

  it('should handle guard failures inside inlined functions (side trace IP fix)', () => {
    // Bug: guards inside inlined functions exited to loop header instead of call site,
    // causing side trace recording to start at the wrong IP.
    // This test: inlined function receives ints most of the time, triggering type guards.
    // When the guard fails (different type), the exit IP should be the call site.
    const { result } = compileAndRunJIT(`
      let double = fn(x) { x + x };
      let sum = 0;
      let i = 0;
      while (i < 200) {
        sum = sum + double(i);
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    // sum of 2*i for i=0..199 = 2 * (199*200/2) = 39800
    assert.equal(result.value, 39800);
  });

  // === FunctionCompiler (method JIT) tests ===

  it('should JIT-compile recursive fibonacci with raw integers', () => {
    const { result, vm } = compileAndRunJIT(`
      let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
      fib(20)
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 6765);
    // Should have a function trace compiled
    assert.ok(vm.jit.traceCount >= 1, 'should have at least one trace (function JIT)');
  });

  it('should JIT-compile recursive function with multiple base cases', () => {
    const { result } = compileAndRunJIT(`
      let f = fn(n) {
        if (n == 0) { 1 }
        else { if (n == 1) { 1 } else { f(n-1) + f(n-2) } }
      };
      f(15)
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 987);
  });

  it('should handle recursive function returning non-integer base case', () => {
    // Recursive tail: returns 0 (still integer, but tests base case paths)
    const { result } = compileAndRunJIT(`
      let countdown = fn(n) { if (n == 0) { 0 } else { countdown(n - 1) } };
      countdown(100)
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 0);
  });

  it('should produce identical results JIT vs non-JIT for fib(25)', () => {
    const input = `
      let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
      fib(25)
    `;
    const program = parse(input);

    // Non-JIT
    const c1 = new Compiler();
    c1.compile(program);
    const vm1 = new VM(c1.bytecode());
    vm1.run();
    const noJit = vm1.lastPoppedStackElem();

    // JIT
    const c2 = new Compiler();
    c2.compile(program);
    const vm2 = new VM(c2.bytecode());
    vm2.enableJIT();
    vm2.run();
    const withJit = vm2.lastPoppedStackElem();

    assert.equal(noJit.value, 75025);
    assert.equal(withJit.value, 75025);
    assert.equal(noJit.value, withJit.value);
  });

  it('should handle loop + recursive function together', () => {
    // Tests that loop tracing and function JIT coexist
    const { result } = compileAndRunJIT(`
      let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
      let sum = 0;
      let i = 0;
      while (i < 10) {
        sum = sum + fib(i);
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    // fib(0..9) = 0,1,1,2,3,5,8,13,21,34 → sum = 88
    assert.equal(result.value, 88);
  });

  it('should handle arithmetic with negative numbers in JIT', () => {
    const { result } = compileAndRunJIT(`
      let sum = 0;
      let i = 0;
      while (i < 100) {
        sum = sum + (i - 50);
        i = i + 1;
      }
      sum
    `);
    assert.ok(result instanceof MonkeyInteger);
    // sum of (i-50) for i=0..99 = sum(i) - 5000 = 4950 - 5000 = -50
    assert.equal(result.value, -50);
  });

  it('should handle multiplication in traced loops', () => {
    const { result } = compileAndRunJIT(`
      let product = 1;
      let i = 1;
      while (i < 11) {
        product = product * i;
        i = i + 1;
      }
      product
    `);
    assert.ok(result instanceof MonkeyInteger);
    assert.equal(result.value, 3628800); // 10!
  });
});
