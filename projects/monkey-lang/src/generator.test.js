import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment } from './object.js';

function evaluate(code) {
  const l = new Lexer(code);
  const p = new Parser(l);
  const program = p.parseProgram();
  if (p.errors.length > 0) throw new Error('Parse errors: ' + p.errors.join(', '));
  return monkeyEval(program, new Environment());
}

describe('Generators', () => {
  it('basic generator with while loop', () => {
    const result = evaluate(`
      let counter = gen(n) {
        let i = 0;
        while (i < n) { yield i; i = i + 1; };
      };
      let r = [];
      for (x in counter(5)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 1, 2, 3, 4]);
  });

  it('fibonacci generator', () => {
    const result = evaluate(`
      let fibs = gen(n) {
        let a = 0;
        let b = 1;
        let i = 0;
        while (i < n) {
          yield a;
          let tmp = a + b;
          a = b;
          b = tmp;
          i = i + 1;
        };
      };
      let r = [];
      for (x in fibs(8)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 1, 1, 2, 3, 5, 8, 13]);
  });

  it('range generator with start and stop', () => {
    const result = evaluate(`
      let range = gen(start, stop) {
        let i = start;
        while (i < stop) { yield i; i = i + 1; };
      };
      let r = [];
      for (x in range(3, 7)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [3, 4, 5, 6]);
  });

  it('conditional yield (filter)', () => {
    const result = evaluate(`
      let evens = gen(n) {
        let i = 0;
        while (i < n) {
          if (i % 2 == 0) { yield i; };
          i = i + 1;
        };
      };
      let r = [];
      for (x in evens(10)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 2, 4, 6, 8]);
  });

  it('nested generators (map)', () => {
    const result = evaluate(`
      let range = gen(n) {
        let i = 0;
        while (i < n) { yield i; i = i + 1; };
      };
      let squares = gen(n) {
        for (x in range(n)) { yield x * x; };
      };
      let r = [];
      for (x in squares(5)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 1, 4, 9, 16]);
  });

  it('generator with closure', () => {
    const result = evaluate(`
      let multiplied = gen(n, factor) {
        let i = 0;
        while (i < n) { yield i * factor; i = i + 1; };
      };
      let r = [];
      for (x in multiplied(4, 3)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 3, 6, 9]);
  });

  it('generator yields strings', () => {
    const result = evaluate(`
      let words = gen() {
        yield "hello";
        yield "world";
        yield "!";
      };
      let r = [];
      for (w in words()) { r = push(r, w); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), ['hello', 'world', '!']);
  });

  it('generator yields arrays', () => {
    const result = evaluate(`
      let pairs = gen() {
        yield [1, 2];
        yield [3, 4];
      };
      let r = [];
      for (p in pairs()) { r = push(r, p); };
      len(r);
    `);
    assert.equal(result.value, 2);
  });

  it('empty generator', () => {
    const result = evaluate(`
      let empty = gen() {};
      let r = [];
      for (x in empty()) { r = push(r, x); };
      len(r);
    `);
    assert.equal(result.value, 0);
  });

  it('generator with early return', () => {
    const result = evaluate(`
      let limited = gen(n) {
        let i = 0;
        while (i < n) {
          yield i;
          if (i == 2) { return null; };
          i = i + 1;
        };
      };
      let r = [];
      for (x in limited(10)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 1, 2]);
  });

  it('generator is an object', () => {
    const result = evaluate(`
      let g = gen() { yield 1; };
      let inst = g();
      type(inst);
    `);
    assert.equal(result.value, 'GENERATOR');
  });

  it('for-in still works with arrays', () => {
    const result = evaluate(`
      let r = [];
      for (x in [10, 20, 30]) { r = push(r, x * 2); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [20, 40, 60]);
  });

  it('for-in still works with strings', () => {
    const result = evaluate(`
      let r = [];
      for (c in "abc") { r = push(r, c); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), ['a', 'b', 'c']);
  });

  it('yield outside generator errors', () => {
    const result = evaluate(`yield 42;`);
    assert.ok(result.inspect().includes('yield outside'));
  });

  it('generator with do-while', () => {
    const result = evaluate(`
      let g = gen() {
        let i = 0;
        do {
          yield i;
          i = i + 1;
        } while (i < 3);
      };
      let r = [];
      for (x in g()) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 1, 2]);
  });
});
