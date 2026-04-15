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

describe('Integration: generators + destructuring + try/catch + for-in', () => {
  it('Sieve of Eratosthenes via generator', () => {
    const result = evaluate(`
      let sieve = gen(limit) {
        let is_prime = [];
        let i = 0;
        while (i <= limit) {
          is_prime = push(is_prime, true);
          i = i + 1;
        };
        is_prime[0] = false;
        is_prime[1] = false;
        let p = 2;
        while (p * p <= limit) {
          if (is_prime[p]) {
            let j = p * p;
            while (j <= limit) {
              is_prime[j] = false;
              j = j + p;
            };
          };
          p = p + 1;
        };
        let k = 2;
        while (k <= limit) {
          if (is_prime[k]) { yield k; };
          k = k + 1;
        };
      };
      let primes = [];
      for (p in sieve(30)) { primes = push(primes, p); };
      primes;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });

  it('try/catch with generator', () => {
    const result = evaluate(`
      let safe_div = gen(numbers) {
        for (n in numbers) {
          try {
            if (n == 0) { throw "division by zero"; };
            yield 100 / n;
          } catch (e) {
            yield -1;
          };
        };
      };
      let results = [];
      for (r in safe_div([4, 2, 0, 5, 0, 10])) {
        results = push(results, r);
      };
      results;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [25, 50, -1, 20, -1, 10]);
  });

  it('destructuring with generator output', () => {
    const result = evaluate(`
      let pairs = gen(n) {
        let i = 0;
        while (i < n) {
          yield [i, i * i];
          i = i + 1;
        };
      };
      let sum_squares = 0;
      for (pair in pairs(5)) {
        let [idx, sq] = pair;
        sum_squares = sum_squares + sq;
      };
      sum_squares;
    `);
    // 0 + 1 + 4 + 9 + 16 = 30
    assert.equal(result.value, 30);
  });

  it('chained generators (filter → map → collect)', () => {
    const result = evaluate(`
      let range = gen(n) {
        let i = 0;
        while (i < n) { yield i; i = i + 1; };
      };
      let filter_gen = gen(g, pred) {
        for (x in g) {
          if (pred(x)) { yield x; };
        };
      };
      let map_gen = gen(g, f) {
        for (x in g) { yield f(x); };
      };
      let nums = range(10);
      let evens = filter_gen(nums, fn(x) { x % 2 == 0 });
      let doubled = map_gen(evens, fn(x) { x * 2 });
      let result = [];
      for (x in doubled) { result = push(result, x); };
      result;
    `);
    // range(10) → [0..9], filter evens → [0,2,4,6,8], double → [0,4,8,12,16]
    assert.deepEqual(result.elements.map(e => e.value), [0, 4, 8, 12, 16]);
  });

  it('recursive fibonacci with memoization', () => {
    const result = evaluate(`
      let memo = {};
      let fib = fn(n) {
        if (n < 2) { return n; };
        let cached = memo[n];
        if (cached != null) { return cached; };
        let result = fib(n - 1) + fib(n - 2);
        memo[n] = result;
        result;
      };
      [fib(0), fib(1), fib(5), fib(10), fib(15)];
    `);
    assert.deepEqual(result.elements.map(e => e.value), [0, 1, 5, 55, 610]);
  });

  it('generator + break in for-in (take first N)', () => {
    const result = evaluate(`
      let naturals = gen(limit) {
        let i = 1;
        while (i <= limit) { yield i; i = i + 1; };
      };
      let first_5 = [];
      let count = 0;
      for (n in naturals(1000)) {
        if (count >= 5) { break; };
        first_5 = push(first_5, n);
        count = count + 1;
      };
      first_5;
    `);
    assert.deepEqual(result.elements.map(e => e.value), [1, 2, 3, 4, 5]);
  });

  it('generator producing hashes', () => {
    const result = evaluate(`
      let person_gen = gen() {
        yield {"name": "Alice", "age": 30};
        yield {"name": "Bob", "age": 25};
        yield {"name": "Carol", "age": 35};
      };
      let names = [];
      for (p in person_gen()) {
        names = push(names, p["name"]);
      };
      names;
    `);
    assert.deepEqual(result.elements.map(e => e.value), ['Alice', 'Bob', 'Carol']);
  });

  it('try/catch/finally execution order', () => {
    const result = evaluate(`
      let log = [];
      try {
        log = push(log, "try");
        throw "error!";
        log = push(log, "unreachable");
      } catch (e) {
        log = push(log, "catch: " + e);
      } finally {
        log = push(log, "finally");
      };
      log;
    `);
    assert.deepEqual(result.elements.map(e => e.value), ['try', 'catch: error!', 'finally']);
  });

  it('nested try/catch with rethrow', () => {
    const result = evaluate(`
      let result = "";
      try {
        try {
          throw "inner";
        } catch (e) {
          result = result + "caught: " + e + " ";
          throw "rethrown";
        };
      } catch (e) {
        result = result + "outer: " + e;
      };
      result;
    `);
    assert.equal(result.value, 'caught: inner outer: rethrown');
  });

  it('for-in with range expression', () => {
    const result = evaluate(`
      let sum = 0;
      for (i in 1..6) { sum = sum + i; };
      sum;
    `);
    // 1 + 2 + 3 + 4 + 5 = 15
    assert.equal(result.value, 15);
  });
});
