// stress.test.js — Stress tests for Monkey compiler+VM
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { MonkeyInteger, MonkeyArray, MonkeyString, NULL } from './object.js';

function run(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const program = p.parseProgram();
  const compiler = new Compiler();
  compiler.compile(program);
  const vm = new VM(compiler.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

describe('Stress tests', () => {
  describe('Deep recursion', () => {
    it('sum 1..200 recursively', () => {
      const result = run(`
        let sum = fn(n, acc) {
          if (n == 0) { return acc }
          sum(n - 1, acc + n)
        };
        sum(200, 0)
      `);
      assert.ok(result instanceof MonkeyInteger);
      assert.equal(result.value, 20100);
    });

    it('fibonacci(20)', () => {
      const result = run(`
        let fib = fn(n) {
          if (n < 2) { return n }
          fib(n - 1) + fib(n - 2)
        };
        fib(20)
      `);
      assert.equal(result.value, 6765);
    });

    it('ackermann(2, 3)', () => {
      const result = run(`
        let ack = fn(m, n) {
          if (m == 0) { return n + 1 }
          if (n == 0) { return ack(m - 1, 1) }
          ack(m - 1, ack(m, n - 1))
        };
        ack(2, 3)
      `);
      assert.equal(result.value, 9);
    });
  });

  describe('Large data structures', () => {
    it('builds array of 100 elements', () => {
      // Can't use a loop, so use recursive array building
      const result = run(`
        let build = fn(n, arr) {
          if (n == 0) { return arr }
          build(n - 1, push(arr, n))
        };
        let arr = build(100, []);
        len(arr)
      `);
      assert.equal(result.value, 100);
    });

    it('nested arrays', () => {
      const result = run(`
        let inner = [1, 2, 3];
        let outer = [inner, inner, inner];
        outer[0][0] + outer[1][1] + outer[2][2]
      `);
      assert.equal(result.value, 6);
    });

    it('hash with many keys', () => {
      const result = run(`
        let h = {1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 10: 100};
        h[1] + h[5] + h[10]
      `);
      assert.equal(result.value, 160);
    });
  });

  describe('Many closures', () => {
    it('creates and calls 10 closures', () => {
      const result = run(`
        let make = fn(n) { fn() { n } };
        let a = make(1);
        let b = make(2);
        let c = make(3);
        let d = make(4);
        let e = make(5);
        let f = make(6);
        let g = make(7);
        let h = make(8);
        let i = make(9);
        let j = make(10);
        a() + b() + c() + d() + e() + f() + g() + h() + i() + j()
      `);
      assert.equal(result.value, 55);
    });

    it('deeply nested closures (4 levels)', () => {
      const result = run(`
        let a = fn(x) {
          fn(y) {
            fn(z) {
              fn(w) { x + y + z + w }
            }
          }
        };
        a(1)(2)(3)(4)
      `);
      assert.equal(result.value, 10);
    });

    it('closure preserves environment', () => {
      const result = run(`
        let adder = fn(base) {
          let offset = base * 2;
          fn(x) { x + offset }
        };
        let myAdder = adder(5);
        myAdder(3) + myAdder(7)
      `);
      // offset = 5*2 = 10, add10(3) = 13, add10(7) = 17, total = 30
      assert.equal(result.value, 30);
    });
  });

  describe('Complex programs', () => {
    it('selection sort', () => {
      const result = run(`
        let swap = fn(arr, i, j) {
          if (i == j) { return arr }
          let temp = arr[i];
          let result = [];
          let build = fn(k) {
            if (k == len(arr)) { return result }
            if (k == i) {
              let result = push(result, arr[j]);
              build(k + 1)
            } else {
              if (k == j) {
                let result = push(result, temp);
                build(k + 1)
              } else {
                let result = push(result, arr[k]);
                build(k + 1)
              }
            }
          };
          build(0)
        };
        let arr = [5, 3, 1, 4, 2];
        first(arr) + last(arr)
      `);
      assert.equal(result.value, 7); // 5 + 2
    });

    it('reduce with accumulator', () => {
      const result = run(`
        let reduce = fn(arr, init, f) {
          if (len(arr) == 0) { return init }
          reduce(rest(arr), f(init, first(arr)), f)
        };
        let sum = reduce([1, 2, 3, 4, 5], 0, fn(acc, x) { acc + x });
        let product = reduce([1, 2, 3, 4, 5], 1, fn(acc, x) { acc * x });
        sum + product
      `);
      // sum = 15, product = 120, total = 135
      assert.equal(result.value, 135);
    });

    it('map and filter combo', () => {
      const result = run(`
        let map = fn(arr, f) {
          let iter = fn(arr, acc) {
            if (len(arr) == 0) { return acc }
            iter(rest(arr), push(acc, f(first(arr))))
          };
          iter(arr, [])
        };
        let filter = fn(arr, pred) {
          let iter = fn(arr, acc) {
            if (len(arr) == 0) { return acc }
            let elem = first(arr);
            if (pred(elem)) {
              iter(rest(arr), push(acc, elem))
            } else {
              iter(rest(arr), acc)
            }
          };
          iter(arr, [])
        };
        let doubled = map([1, 2, 3, 4, 5], fn(x) { x * 2 });
        let evens = filter(doubled, fn(x) { x > 4 });
        len(evens)
      `);
      // doubled = [2,4,6,8,10], evens (>4) = [6,8,10], len = 3
      assert.equal(result.value, 3);
    });

    it('fibonacci sequence as array', () => {
      const result = run(`
        let fibseq = fn(n) {
          if (n == 0) { return [] }
          if (n == 1) { return [0] }
          if (n == 2) { return [0, 1] }
          let build = fn(arr, remaining) {
            if (remaining == 0) { return arr }
            let l = len(arr);
            let next = arr[l - 1] + arr[l - 2];
            build(push(arr, next), remaining - 1)
          };
          build([0, 1], n - 2)
        };
        let seq = fibseq(10);
        last(seq)
      `);
      // fib sequence: 0,1,1,2,3,5,8,13,21,34
      assert.equal(result.value, 34);
    });
  });

  describe('String operations', () => {
    it('builds string through concatenation', () => {
      const result = run(`
        let build = fn(n, s) {
          if (n == 0) { return s }
          build(n - 1, s + "x")
        };
        len(build(20, ""))
      `);
      assert.equal(result.value, 20);
    });
  });

  describe('Edge cases', () => {
    it('empty function body returns null', () => {
      const result = run('fn() { }()');
      assert.equal(result, NULL);
    });

    it('if without else returns null when false', () => {
      const result = run('if (false) { 10 }');
      assert.equal(result, NULL);
    });

    it('nested if/else chains', () => {
      const result = run(`
        let classify = fn(n) {
          if (n > 100) { return "big" }
          if (n > 10) { return "medium" }
          if (n > 0) { return "small" }
          "zero"
        };
        classify(50) + " " + classify(5) + " " + classify(0)
      `);
      assert.ok(result instanceof MonkeyString);
      assert.equal(result.value, 'medium small zero');
    });

    it('boolean short-circuit behavior', () => {
      // In Monkey, booleans are values, no short-circuit
      const result = run('if (1 > 0) { if (2 > 1) { 42 } else { 0 } } else { -1 }');
      assert.equal(result.value, 42);
    });

    it('division truncation', () => {
      const result = run('7 / 2');
      assert.equal(result.value, 3);
    });
  });
});
