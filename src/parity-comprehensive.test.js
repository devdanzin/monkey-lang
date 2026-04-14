// parity-comprehensive.test.js — Final parity test for all features
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { Environment, NULL } from './object.js';

function runInterp(input) {
  return monkeyEval(new Parser(new Lexer(input)).parseProgram(), new Environment());
}

function runVM(input) {
  const c = new Compiler();
  c.compile(new Parser(new Lexer(input)).parseProgram());
  const vm = new VM(c.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

function bothMatch(input) {
  const i = runInterp(input);
  const v = runVM(input);
  assert.equal(i.inspect(), v.inspect(), `Parity mismatch for: ${input}\n  interp=${i.inspect()} vm=${v.inspect()}`);
  return v;
}

describe('Comprehensive Parity Tests', () => {
  describe('Arithmetic', () => {
    const cases = [
      '1 + 2', '10 - 3', '2 * 3', '10 / 2', '7 % 3',
      '(1 + 2) * 3', '-5', '-(1 + 2)',
      '2 + 3 * 4', '(2 + 3) * 4',
    ];
    for (const c of cases) {
      it(c, () => bothMatch(c));
    }
  });

  describe('Comparisons', () => {
    const cases = [
      '1 < 2', '2 > 1', '1 == 1', '1 != 2',
      '5 >= 5', '5 >= 4', '5 >= 6',
      '5 <= 5', '5 <= 6', '5 <= 4',
      'true == true', 'false == false', 'true != false',
    ];
    for (const c of cases) {
      it(c, () => bothMatch(c));
    }
  });

  describe('Logical', () => {
    const cases = [
      'true && true', 'true && false', 'false && true', 'false && false',
      'true || false', 'false || true', 'false || false',
    ];
    for (const c of cases) {
      it(c, () => bothMatch(c));
    }
  });

  describe('Strings', () => {
    const cases = [
      '"hello" + " world"', 'len("hello")', '"abc"[0]', '"abc"[2]',
      '"abc"[-1]', '"ha" * 3', '3 * "ha"',
    ];
    for (const c of cases) {
      it(c, () => bothMatch(c));
    }
  });

  describe('Arrays', () => {
    const cases = [
      '[1, 2, 3][0]', '[1, 2, 3][2]', '[1, 2, 3][-1]',
      'len([1, 2, 3])', 'first([1, 2, 3])', 'last([1, 2, 3])',
      'len(rest([1, 2, 3]))', 'len(push([1, 2], 3))',
    ];
    for (const c of cases) {
      it(c, () => bothMatch(c));
    }
  });

  describe('Functions', () => {
    const cases = [
      'let f = fn(x) { x * 2 }; f(5)',
      'let add = fn(a, b) { a + b }; add(3, 4)',
      'let fib = fn(n) { if (n <= 1) { n } else { fib(n-1) + fib(n-2) } }; fib(10)',
      'fn(x) { fn(y) { x + y } }(3)(4)', // closure
    ];
    for (const c of cases) {
      it(c.slice(0, 40) + '...', () => bothMatch(c));
    }
  });

  describe('Control flow', () => {
    const cases = [
      'if (true) { 1 } else { 2 }',
      'if (false) { 1 } else { 2 }',
      'if (1 > 2) { 1 } else { 2 }',
      'let x = 0; while (x < 5) { set x = x + 1; } x',
      'let s = 0; for (let i = 0; i < 5; set i = i + 1) { set s = s + i; } s',
    ];
    for (const c of cases) {
      it(c.slice(0, 50) + '...', () => bothMatch(c));
    }
  });

  describe('Builtins', () => {
    const cases = [
      'len("hello")', 'len([1,2,3])',
      'first([10,20,30])', 'last([10,20,30])',
      'type(42)', 'type("hi")', 'type(true)',
      'str(42)', 'int("123")',
      'upper("hello")', 'lower("HELLO")',
      'trim("  hi  ")',
      'sort([3,1,2])',
      'range(5)',
    ];
    for (const c of cases) {
      it(c, () => bothMatch(c));
    }
  });

  describe('Hash maps', () => {
    const cases = [
      '{"a": 1, "b": 2}["a"]',
      '{"a": 1}["b"]',
      'len(keys({"a": 1, "b": 2}))',
      'len(values({"x": 10, "y": 20}))',
    ];
    for (const c of cases) {
      it(c, () => bothMatch(c));
    }
  });
});
