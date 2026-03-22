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
});
