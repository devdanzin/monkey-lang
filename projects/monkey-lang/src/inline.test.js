import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { inlineFunctions } from './inline.js';
import { monkeyEval } from './evaluator.js';
import { Environment } from './object.js';

function parse(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  return p.parseProgram();
}

function evalInlined(input) {
  const program = parse(input);
  const { program: inlined, stats } = inlineFunctions(program);
  const env = new Environment();
  const result = monkeyEval(inlined, env);
  return { result, stats };
}

describe('Function Inlining', () => {
  describe('basic inlining', () => {
    it('inlines single-expression function', () => {
      const { result, stats } = evalInlined(`
        let double = fn(x) { x * 2 };
        double(5)
      `);
      assert.equal(result.value, 10);
      assert.equal(stats.inlined, 1);
    });

    it('inlines identity function', () => {
      const { result, stats } = evalInlined(`
        let id = fn(x) { x };
        id(42)
      `);
      assert.equal(result.value, 42);
      assert.equal(stats.inlined, 1);
    });

    it('inlines function with arithmetic', () => {
      const { result, stats } = evalInlined(`
        let add = fn(a, b) { a + b };
        add(3, 7)
      `);
      assert.equal(result.value, 10);
      assert.ok(stats.inlined >= 1);
    });

    it('inlines function with return statement', () => {
      const { result, stats } = evalInlined(`
        let square = fn(n) { return n * n };
        square(6)
      `);
      assert.equal(result.value, 36);
      assert.equal(stats.inlined, 1);
    });

    it('preserves correctness for multiple calls', () => {
      const { result, stats } = evalInlined(`
        let inc = fn(x) { x + 1 };
        inc(inc(inc(0)))
      `);
      assert.equal(result.value, 3);
      assert.ok(stats.inlined >= 1);
    });
  });

  describe('should NOT inline', () => {
    it('does not inline recursive functions', () => {
      const { result, stats } = evalInlined(`
        let fib = fn(n) { if (n < 2) { n } else { fib(n - 1) + fib(n - 2) } };
        fib(10)
      `);
      assert.equal(result.value, 55);
      assert.equal(stats.inlined, 0);
    });

    it('does not inline functions with side effects (puts)', () => {
      const { stats } = evalInlined(`
        let greet = fn(name) { puts("hello " + name) };
        let x = 42
      `);
      assert.equal(stats.inlined, 0);
    });

    it('does not inline large functions', () => {
      const { result, stats } = evalInlined(`
        let big = fn(x) {
          let a = x + 1;
          let b = a + 2;
          let c = b + 3;
          let d = c + 4;
          let e = d + 5;
          let f = e + 6;
          return f
        };
        big(0)
      `);
      assert.equal(result.value, 21);
      assert.equal(stats.inlined, 0);
    });
  });

  describe('nested inlining', () => {
    it('inlines into if expressions', () => {
      const { result, stats } = evalInlined(`
        let isPositive = fn(x) { x > 0 };
        if (isPositive(5)) { 1 } else { 0 }
      `);
      assert.equal(result.value, 1);
      assert.ok(stats.inlined >= 1);
    });

    it('inlines inside let bindings', () => {
      const { result, stats } = evalInlined(`
        let double = fn(x) { x * 2 };
        let y = double(21);
        y
      `);
      assert.equal(result.value, 42);
      assert.equal(stats.inlined, 1);
    });
  });

  describe('statistics', () => {
    it('counts analyzed functions', () => {
      const { stats } = evalInlined(`
        let a = fn(x) { x };
        let b = fn(x) { x + 1 };
        a(1)
      `);
      assert.ok(stats.analyzed >= 2);
    });

    it('counts skipped functions', () => {
      const { stats } = evalInlined(`
        let rec = fn(n) { if (n == 0) { 0 } else { rec(n - 1) } };
        rec(5)
      `);
      assert.ok(stats.skipped >= 1);
    });
  });

  describe('edge cases', () => {
    it('handles function with no params', () => {
      const { result, stats } = evalInlined(`
        let answer = fn() { 42 };
        answer()
      `);
      assert.equal(result.value, 42);
      assert.equal(stats.inlined, 1);
    });

    it('handles function that returns boolean', () => {
      const { result, stats } = evalInlined(`
        let truthy = fn() { true };
        truthy()
      `);
      assert.equal(result.value, true);
      assert.equal(stats.inlined, 1);
    });

    it('handles unused functions without error', () => {
      const { result, stats } = evalInlined(`
        let unused = fn(x) { x };
        42
      `);
      assert.equal(result.value, 42);
    });

    it('handles programs with no functions', () => {
      const { result, stats } = evalInlined(`1 + 2`);
      assert.equal(result.value, 3);
      assert.equal(stats.analyzed, 0);
      assert.equal(stats.inlined, 0);
    });
  });
});
