// parity.test.js — Verify compiler+VM matches tree-walker evaluator
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment, MonkeyInteger, MonkeyString, MonkeyArray, MonkeyHash, MonkeyError, TRUE, FALSE, NULL } from './object.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function runInterpreter(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const program = p.parseProgram();
  return monkeyEval(program, new Environment());
}

function runCompilerVM(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const program = p.parseProgram();
  const compiler = new Compiler();
  compiler.compile(program);
  const vm = new VM(compiler.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

function compareResults(interp, vm, input) {
  // Both null
  if (interp === NULL && vm === NULL) return;

  // Both integers
  if (interp instanceof MonkeyInteger && vm instanceof MonkeyInteger) {
    assert.equal(vm.value, interp.value, `VM value mismatch for: ${input}`);
    return;
  }

  // Both strings
  if (interp instanceof MonkeyString && vm instanceof MonkeyString) {
    assert.equal(vm.value, interp.value, `VM string mismatch for: ${input}`);
    return;
  }

  // Both booleans
  if (interp === TRUE && vm === TRUE) return;
  if (interp === FALSE && vm === FALSE) return;

  // Both arrays
  if (interp instanceof MonkeyArray && vm instanceof MonkeyArray) {
    assert.equal(vm.elements.length, interp.elements.length, `Array length mismatch for: ${input}`);
    for (let i = 0; i < interp.elements.length; i++) {
      compareResults(interp.elements[i], vm.elements[i], `${input}[${i}]`);
    }
    return;
  }

  // Both hashes
  if (interp instanceof MonkeyHash && vm instanceof MonkeyHash) {
    assert.equal(vm.pairs.size, interp.pairs.size, `Hash size mismatch for: ${input}`);
    return;
  }

  // Type mismatch
  assert.fail(`Type mismatch for "${input}": interp=${interp?.inspect?.()} vm=${vm?.inspect?.()}`);
}

function testParity(input) {
  const interpResult = runInterpreter(input);
  // Skip error results (interpreter returns MonkeyError, VM throws)
  if (interpResult instanceof MonkeyError) return;
  const vmResult = runCompilerVM(input);
  compareResults(interpResult, vmResult, input);
}

describe('Parity: tree-walker vs compiler+VM', () => {
  describe('integer arithmetic', () => {
    const tests = [
      '5', '10', '-5', '-10',
      '5 + 5 + 5 + 5 - 10',
      '2 * 2 * 2 * 2 * 2',
      '-50 + 100 + -50',
      '5 * 2 + 10',
      '5 + 2 * 10',
      '50 / 2 * 2 + 10',
      '2 * (5 + 10)',
      '3 * 3 * 3 + 10',
      '3 * (3 * 3) + 10',
      '(5 + 10 * 2 + 15 / 3) * 2 + -10',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('booleans', () => {
    const tests = [
      'true', 'false',
      '1 < 2', '1 > 2', '1 < 1', '1 > 1',
      '1 == 1', '1 != 1', '1 == 2', '1 != 2',
      'true == true', 'false == false',
      'true == false', 'true != false',
      '(1 < 2) == true', '(1 > 2) == true',
      '!true', '!false', '!5', '!!true', '!!false', '!!5',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('conditionals', () => {
    const tests = [
      'if (true) { 10 }',
      'if (false) { 10 }',
      'if (1) { 10 }',
      'if (1 < 2) { 10 }',
      'if (1 > 2) { 10 }',
      'if (1 > 2) { 10 } else { 20 }',
      'if (1 < 2) { 10 } else { 20 }',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('let statements', () => {
    const tests = [
      'let a = 5; a;',
      'let a = 5 * 5; a;',
      'let a = 5; let b = a; b;',
      'let a = 5; let b = a; let c = a + b + 5; c;',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('strings', () => {
    const tests = [
      '"Hello World!"',
      '"Hello" + " " + "World!"',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('functions', () => {
    const tests = [
      'let identity = fn(x) { x; }; identity(5);',
      'let double = fn(x) { x * 2; }; double(5);',
      'let add = fn(x, y) { x + y; }; add(5, 5);',
      'let add = fn(x, y) { x + y; }; add(5 + 5, add(5, 5));',
      'fn(x) { x; }(5)',
      'let identity = fn(x) { return x; }; identity(5);',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('closures', () => {
    const tests = [
      'let newAdder = fn(x) { fn(y) { x + y }; }; let addTwo = newAdder(2); addTwo(2);',
      'let a = 10; let f = fn() { a }; f();',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('builtins', () => {
    const tests = [
      'len("")',
      'len("four")',
      'len("hello world")',
      'len([1, 2, 3])',
      'len([])',
      'first([1, 2, 3])',
      'last([1, 2, 3])',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('arrays', () => {
    const tests = [
      '[1, 2 * 2, 3 + 3]',
      '[1, 2, 3][0]',
      '[1, 2, 3][1]',
      '[1, 2, 3][2]',
      'let i = 0; [1][i];',
      '[1, 2, 3][1 + 1];',
      'let myArray = [1, 2, 3]; myArray[2];',
      '[1, 2, 3][3]',
      '[1, 2, 3][-1]',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('hashes', () => {
    const tests = [
      '{"foo": 5}["foo"]',
      '{}["foo"]',
      '{5: 5}[5]',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('return statements', () => {
    const tests = [
      'let f = fn() { return 10; }; f();',
      'let f = fn() { return 10; 9; }; f();',
      'let f = fn() { return 2 * 5; 9; }; f();',
      'let f = fn() { 9; return 2 * 5; 9; }; f();',
    ];
    for (const input of tests) {
      it(input, () => testParity(input));
    }
  });

  describe('recursive fibonacci', () => {
    it('fibonacci(10) = 55', () => {
      const input = `
let fibonacci = fn(x) {
  if (x == 0) { return 0; }
  if (x == 1) { return 1; }
  fibonacci(x - 1) + fibonacci(x - 2);
};
fibonacci(10);`;
      testParity(input);
    });
  });

  describe('nested return', () => {
    it('nested if with return', () => {
      testParity('if (10 > 1) { if (10 > 1) { return 10; } return 1; }');
    });
  });

  describe('complex programs', () => {
    it('counter with closure', () => {
      testParity(`
        let makeCounter = fn() {
          let count = 0;
          fn() {
            let count = count + 1;
            count
          }
        };
        let counter = makeCounter();
        counter();
      `);
    });

    it('array manipulation', () => {
      testParity(`
        let arr = [1, 2, 3, 4, 5];
        let sum = fn(a) {
          if (len(a) == 0) { return 0; }
          first(a) + sum(rest(a));
        };
        sum(arr);
      `);
    });
  });
});
