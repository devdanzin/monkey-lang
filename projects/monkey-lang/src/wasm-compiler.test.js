// Tests for Monkey → WASM Compiler
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileAndRun, compileToInstance } from './wasm-compiler.js';

describe('WASM Compiler', () => {

  describe('Integer literals', () => {
    it('compiles integer constant', async () => {
      assert.strictEqual(await compileAndRun('42'), 42);
    });

    it('compiles zero', async () => {
      assert.strictEqual(await compileAndRun('0'), 0);
    });

    it('compiles negative via prefix', async () => {
      assert.strictEqual(await compileAndRun('-5'), -5);
    });
  });

  describe('Boolean literals', () => {
    it('true is 1', async () => {
      assert.strictEqual(await compileAndRun('true'), 1);
    });

    it('false is 0', async () => {
      assert.strictEqual(await compileAndRun('false'), 0);
    });
  });

  describe('Arithmetic', () => {
    it('addition', async () => {
      assert.strictEqual(await compileAndRun('3 + 4'), 7);
    });

    it('subtraction', async () => {
      assert.strictEqual(await compileAndRun('10 - 3'), 7);
    });

    it('multiplication', async () => {
      assert.strictEqual(await compileAndRun('6 * 7'), 42);
    });

    it('division', async () => {
      assert.strictEqual(await compileAndRun('42 / 6'), 7);
    });

    it('modulo', async () => {
      assert.strictEqual(await compileAndRun('10 % 3'), 1);
    });

    it('complex expression', async () => {
      assert.strictEqual(await compileAndRun('(2 + 3) * (4 + 1)'), 25);
    });

    it('nested arithmetic', async () => {
      assert.strictEqual(await compileAndRun('1 + 2 * 3 + 4'), 11);
    });
  });

  describe('Comparisons', () => {
    it('equal true', async () => {
      assert.strictEqual(await compileAndRun('5 == 5'), 1);
    });

    it('equal false', async () => {
      assert.strictEqual(await compileAndRun('5 == 6'), 0);
    });

    it('not equal', async () => {
      assert.strictEqual(await compileAndRun('5 != 6'), 1);
    });

    it('less than', async () => {
      assert.strictEqual(await compileAndRun('3 < 5'), 1);
    });

    it('greater than', async () => {
      assert.strictEqual(await compileAndRun('5 > 3'), 1);
    });

    it('less or equal', async () => {
      assert.strictEqual(await compileAndRun('5 <= 5'), 1);
    });

    it('greater or equal', async () => {
      assert.strictEqual(await compileAndRun('5 >= 6'), 0);
    });
  });

  describe('Prefix operators', () => {
    it('negation', async () => {
      assert.strictEqual(await compileAndRun('-10'), -10);
    });

    it('bang true', async () => {
      assert.strictEqual(await compileAndRun('!true'), 0);
    });

    it('bang false', async () => {
      assert.strictEqual(await compileAndRun('!false'), 1);
    });

    it('double negation', async () => {
      assert.strictEqual(await compileAndRun('!!true'), 1);
    });

    it('bang zero', async () => {
      assert.strictEqual(await compileAndRun('!0'), 1);
    });

    it('bang nonzero', async () => {
      assert.strictEqual(await compileAndRun('!5'), 0);
    });
  });

  describe('Let bindings', () => {
    it('simple let', async () => {
      assert.strictEqual(await compileAndRun('let x = 10; x'), 10);
    });

    it('let with expression', async () => {
      assert.strictEqual(await compileAndRun('let x = 5 + 3; x'), 8);
    });

    it('multiple lets', async () => {
      assert.strictEqual(await compileAndRun('let x = 5; let y = 10; x + y'), 15);
    });

    it('let using previous binding', async () => {
      assert.strictEqual(await compileAndRun('let x = 5; let y = x * 2; y'), 10);
    });
  });

  describe('Assignment', () => {
    it('simple assignment', async () => {
      assert.strictEqual(await compileAndRun('let x = 5; x = 10; x'), 10);
    });

    it('assignment with arithmetic', async () => {
      assert.strictEqual(await compileAndRun('let x = 5; x = x + 3; x'), 8);
    });
  });

  describe('If/else expressions', () => {
    it('if true', async () => {
      assert.strictEqual(await compileAndRun('if (true) { 10 } else { 20 }'), 10);
    });

    it('if false', async () => {
      assert.strictEqual(await compileAndRun('if (false) { 10 } else { 20 }'), 20);
    });

    it('if with comparison', async () => {
      assert.strictEqual(await compileAndRun('if (5 > 3) { 1 } else { 0 }'), 1);
    });

    it('if without else', async () => {
      assert.strictEqual(await compileAndRun('if (false) { 10 }'), 0);
    });

    it('nested if', async () => {
      assert.strictEqual(await compileAndRun(`
        if (true) {
          if (false) { 1 } else { 2 }
        } else {
          3
        }
      `), 2);
    });

    it('if with let in body', async () => {
      assert.strictEqual(await compileAndRun(`
        let x = 5;
        if (x > 3) { x * 2 } else { x * 3 }
      `), 10);
    });
  });

  describe('While loops', () => {
    it('basic while', async () => {
      assert.strictEqual(await compileAndRun(`
        let x = 0;
        let i = 0;
        while (i < 10) {
          x = x + i;
          i = i + 1;
        }
        x
      `), 45);
    });

    it('while with early exit condition', async () => {
      assert.strictEqual(await compileAndRun(`
        let x = 1;
        while (x < 100) {
          x = x * 2;
        }
        x
      `), 128);
    });
  });

  describe('For loops', () => {
    it('basic for loop', async () => {
      assert.strictEqual(await compileAndRun(`
        let sum = 0;
        for (let i = 1; i <= 10; i = i + 1) {
          sum = sum + i;
        }
        sum
      `), 55);
    });

    it('for loop with multiplication', async () => {
      assert.strictEqual(await compileAndRun(`
        let result = 1;
        for (let i = 1; i <= 5; i = i + 1) {
          result = result * i;
        }
        result
      `), 120);
    });
  });

  describe('Functions', () => {
    it('simple function call', async () => {
      const instance = await compileToInstance(`
        let double = fn(x) { x * 2 };
        double(21)
      `);
      assert.strictEqual(instance.exports.main(), 42);
      assert.strictEqual(instance.exports.double(5), 10);
    });

    it('function with multiple params', async () => {
      assert.strictEqual(await compileAndRun(`
        let add = fn(a, b) { a + b };
        add(10, 32)
      `), 42);
    });

    it('function with if', async () => {
      assert.strictEqual(await compileAndRun(`
        let max = fn(a, b) { if (a > b) { a } else { b } };
        max(5, 10)
      `), 10);
    });

    it('function with local variables', async () => {
      assert.strictEqual(await compileAndRun(`
        let compute = fn(x) {
          let doubled = x * 2;
          let result = doubled + 1;
          result
        };
        compute(5)
      `), 11);
    });

    it('recursive function (fibonacci)', async () => {
      assert.strictEqual(await compileAndRun(`
        let fib = fn(n) {
          if (n <= 1) { n } else { fib(n - 1) + fib(n - 2) }
        };
        fib(10)
      `), 55);
    });

    it('recursive function (factorial)', async () => {
      assert.strictEqual(await compileAndRun(`
        let factorial = fn(n) {
          if (n <= 1) { 1 } else { n * factorial(n - 1) }
        };
        factorial(10)
      `), 3628800);
    });

    it('multiple functions calling each other', async () => {
      assert.strictEqual(await compileAndRun(`
        let square = fn(x) { x * x };
        let sumOfSquares = fn(a, b) { square(a) + square(b) };
        sumOfSquares(3, 4)
      `), 25);
    });
  });

  describe('Return statements', () => {
    it('explicit return', async () => {
      assert.strictEqual(await compileAndRun(`
        let abs = fn(x) {
          if (x < 0) { return -x; }
          x
        };
        abs(-42)
      `), 42);
    });

    it('return from main', async () => {
      assert.strictEqual(await compileAndRun('return 99;'), 99);
    });
  });

  describe('Logical operators', () => {
    it('and true', async () => {
      assert.strictEqual(await compileAndRun('true && true'), 1);
    });

    it('and false', async () => {
      assert.strictEqual(await compileAndRun('true && false'), 0);
    });

    it('and short circuit', async () => {
      assert.strictEqual(await compileAndRun('false && 42'), 0);
    });

    it('or true', async () => {
      assert.strictEqual(await compileAndRun('false || true'), 1);
    });

    it('or short circuit', async () => {
      assert.strictEqual(await compileAndRun('5 || 0'), 5);
    });
  });

  describe('Complex programs', () => {
    it('GCD', async () => {
      assert.strictEqual(await compileAndRun(`
        let gcd = fn(a, b) {
          if (b == 0) { a } else { gcd(b, a % b) }
        };
        gcd(48, 18)
      `), 6);
    });

    it('power function', async () => {
      assert.strictEqual(await compileAndRun(`
        let pow = fn(base, exp) {
          if (exp == 0) { return 1; }
          base * pow(base, exp - 1)
        };
        pow(2, 10)
      `), 1024);
    });

    it('sum with accumulator', async () => {
      assert.strictEqual(await compileAndRun(`
        let sum = 0;
        let i = 1;
        while (i <= 100) {
          sum = sum + i;
          i = i + 1;
        }
        sum
      `), 5050);
    });

    it('nested loops', async () => {
      assert.strictEqual(await compileAndRun(`
        let count = 0;
        let i = 0;
        while (i < 10) {
          let j = 0;
          while (j < 10) {
            count = count + 1;
            j = j + 1;
          }
          i = i + 1;
        }
        count
      `), 100);
    });
  });
});
