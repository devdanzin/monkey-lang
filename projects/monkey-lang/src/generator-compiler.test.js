import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function runCompiled(code) {
  const l = new Lexer(code);
  const p = new Parser(l);
  const program = p.parseProgram();
  if (p.errors.length > 0) throw new Error('Parse: ' + p.errors.join(', '));
  const c = new Compiler();
  const err = c.compile(program);
  if (err) throw new Error('Compile: ' + err);
  const vm = new VM(c.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

describe('Generators (compiler/VM path)', () => {
  it('basic counter generator', () => {
    const r = runCompiled(`
      let counter = gen(n) {
        let i = 0;
        while (i < n) { yield i; i = i + 1; };
      };
      let r = [];
      for (x in counter(5)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [0, 1, 2, 3, 4]);
  });

  it('fibonacci generator', () => {
    const r = runCompiled(`
      let fibs = gen(n) {
        let a = 0; let b = 1; let i = 0;
        while (i < n) {
          yield a;
          let tmp = a + b; a = b; b = tmp;
          i = i + 1;
        };
      };
      let r = [];
      for (x in fibs(10)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
  });

  it('conditional yield', () => {
    const r = runCompiled(`
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
    assert.deepEqual(r.elements.map(e => e.value), [0, 2, 4, 6, 8]);
  });

  it('generator with closure over outer variable', () => {
    const r = runCompiled(`
      let multiplier = 3;
      let g = gen(n) {
        let i = 0;
        while (i < n) { yield i * multiplier; i = i + 1; };
      };
      let r = [];
      for (x in g(4)) { r = push(r, x); };
      r;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [0, 3, 6, 9]);
  });

  it('nested generators', () => {
    const r = runCompiled(`
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
    assert.deepEqual(r.elements.map(e => e.value), [0, 1, 4, 9, 16]);
  });

  it('empty generator', () => {
    const r = runCompiled(`
      let empty = gen() {};
      let r = [];
      for (x in empty()) { r = push(r, x); };
      len(r);
    `);
    assert.equal(r.value, 0);
  });

  it('generator yielding strings', () => {
    const r = runCompiled(`
      let words = gen() {
        yield "hello";
        yield "world";
      };
      let r = [];
      for (w in words()) { r = push(r, w); };
      r;
    `);
    assert.deepEqual(r.elements.map(e => e.value), ['hello', 'world']);
  });

  it('generator with break in for-in', () => {
    const r = runCompiled(`
      let big = gen() {
        let i = 0;
        while (i < 1000) { yield i; i = i + 1; };
      };
      let r = [];
      let count = 0;
      for (n in big()) {
        if (count >= 3) { break; };
        r = push(r, n);
        count = count + 1;
      };
      r;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [0, 1, 2]);
  });

  it('sieve of eratosthenes via generator', () => {
    const r = runCompiled(`
      let sieve = gen(limit) {
        let is_prime = [];
        let i = 0;
        while (i <= limit) { is_prime = push(is_prime, true); i = i + 1; };
        is_prime[0] = false;
        is_prime[1] = false;
        let p = 2;
        while (p * p <= limit) {
          if (is_prime[p]) {
            let j = p * p;
            while (j <= limit) { is_prime[j] = false; j = j + p; };
          };
          p = p + 1;
        };
        let k = 2;
        while (k <= limit) {
          if (is_prime[k]) { yield k; };
          k = k + 1;
        };
      };
      let r = [];
      for (p in sieve(30)) { r = push(r, p); };
      r;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });

  it('generator sum with accumulator', () => {
    const r = runCompiled(`
      let range = gen(n) {
        let i = 1;
        while (i <= n) { yield i; i = i + 1; };
      };
      let sum = 0;
      for (x in range(100)) { sum = sum + x; };
      sum;
    `);
    assert.equal(r.value, 5050); // sum 1..100 = 5050
  });
});
