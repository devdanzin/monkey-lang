// Tests for Monkey → WASM Compiler
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileAndRun, compileToInstance, formatWasmValue, WasmCompiler } from './wasm-compiler.js';
import { disassemble } from './wasm-dis.js';

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

    it('for-in loop over array', async () => {
      assert.strictEqual(await compileAndRun(`
        let sum = 0;
        let arr = [10, 20, 30];
        for (x in arr) {
          sum = sum + x;
        }
        sum
      `), 60);
    });

    it('for-in with puts', async () => {
      const lines = [];
      await compileAndRun(`
        for (x in [1, 2, 3]) {
          puts(x);
        }
      `, { outputLines: lines });
      assert.deepStrictEqual(lines, ['1', '2', '3']);
    });

    it('range expression', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = 0..5;
        len(arr)
      `), 5);
    });

    it('for-in with range', async () => {
      assert.strictEqual(await compileAndRun(`
        let sum = 0;
        for (x in 0..10) {
          sum = sum + x;
        }
        sum
      `), 45);
    });

    it('range with variables', async () => {
      const lines = [];
      await compileAndRun(`
        for (i in 1..4) {
          puts(i);
        }
      `, { outputLines: lines });
      assert.deepStrictEqual(lines, ['1', '2', '3']);
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

  describe('Arrays', () => {
    it('array literal and indexing', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [10, 20, 30];
        arr[1]
      `), 20);
    });

    it('array length', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [1, 2, 3, 4, 5];
        len(arr)
      `), 5);
    });

    it('array first and last', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [100, 200, 300];
        arr[0] + arr[2]
      `), 400);
    });

    it('array with computed elements', async () => {
      assert.strictEqual(await compileAndRun(`
        let x = 5;
        let arr = [x, x * 2, x * 3];
        arr[0] + arr[1] + arr[2]
      `), 30);
    });

    it('array sum via loop', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [1, 2, 3, 4, 5];
        let sum = 0;
        let i = 0;
        while (i < len(arr)) {
          sum = sum + arr[i];
          i = i + 1;
        }
        sum
      `), 15);
    });

    it('push creates new array', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [1, 2, 3];
        let arr2 = push(arr, 4);
        len(arr2)
      `), 4);
    });

    it('push preserves elements', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [10, 20];
        let arr2 = push(arr, 30);
        arr2[0] + arr2[1] + arr2[2]
      `), 60);
    });

    it('empty array', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [];
        len(arr)
      `), 0);
    });

    it('build array with push in loop', async () => {
      assert.strictEqual(await compileAndRun(`
        let arr = [];
        let i = 0;
        while (i < 5) {
          arr = push(arr, i * i);
          i = i + 1;
        }
        arr[3]
      `), 9);
    });
  });

  describe('Strings', () => {
    it('string literal returns pointer', async () => {
      // String literal returns a non-zero pointer
      const result = await compileAndRun('"hello"');
      assert.ok(result > 0, `expected positive pointer, got ${result}`);
    });

    it('string length', async () => {
      assert.strictEqual(await compileAndRun('len("hello")'), 5);
    });

    it('empty string length', async () => {
      assert.strictEqual(await compileAndRun('len("")'), 0);
    });

    it('string stored in variable', async () => {
      assert.strictEqual(await compileAndRun(`
        let s = "world";
        len(s)
      `), 5);
    });

    it('can read string bytes from memory', async () => {
      const instance = await compileToInstance('"Hi"');
      const result = instance.exports.main();
      const mem = new Uint8Array(instance.exports.memory.buffer);
      // At result+8 should be 'H', result+9 should be 'i'
      assert.strictEqual(mem[result + 8], 72);  // 'H'
      assert.strictEqual(mem[result + 9], 105); // 'i'
    });
  });

  describe('puts and output', () => {
    it('puts integer', async () => {
      const lines = [];
      await compileAndRun('puts(42)', { outputLines: lines });
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0], '42');
    });

    it('puts multiple values', async () => {
      const lines = [];
      await compileAndRun('puts(1); puts(2); puts(3)', { outputLines: lines });
      assert.deepStrictEqual(lines, ['1', '2', '3']);
    });

    it('puts in loop', async () => {
      const lines = [];
      await compileAndRun(`
        let i = 0;
        while (i < 5) {
          puts(i);
          i = i + 1;
        }
      `, { outputLines: lines });
      assert.deepStrictEqual(lines, ['0', '1', '2', '3', '4']);
    });

    it('puts string literal', async () => {
      const lines = [];
      await compileAndRun('puts("hello")', { outputLines: lines });
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0], 'hello');
    });

    it('puts array', async () => {
      const lines = [];
      await compileAndRun('puts([1, 2, 3])', { outputLines: lines });
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0], '[1, 2, 3]');
    });

    it('puts from function', async () => {
      const lines = [];
      await compileAndRun(`
        let greet = fn(x) { puts(x); x };
        greet(42)
      `, { outputLines: lines });
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0], '42');
    });

    it('puts returns null (0)', async () => {
      const result = await compileAndRun('puts(42)');
      assert.strictEqual(result, 0);
    });

    it('fizzbuzz with puts', async () => {
      const lines = [];
      await compileAndRun(`
        let i = 1;
        while (i <= 15) {
          if (i % 15 == 0) { puts(0); }
          if (i % 15 != 0) {
            if (i % 3 == 0) { puts(3); }
            if (i % 3 != 0) {
              if (i % 5 == 0) { puts(5); }
              if (i % 5 != 0) { puts(i); }
            }
          }
          i = i + 1;
        }
      `, { outputLines: lines });
      assert.strictEqual(lines.length, 15);
      // 1,2,fizz,4,buzz,fizz,7,8,fizz,buzz,11,fizz,13,14,fizzbuzz
      assert.strictEqual(lines[0], '1');
      assert.strictEqual(lines[2], '3');  // fizz (represented as 3)
      assert.strictEqual(lines[4], '5');  // buzz (represented as 5)
      assert.strictEqual(lines[14], '0'); // fizzbuzz (represented as 0)
    });
  });

  describe('String operations', () => {
    it('string concatenation', async () => {
      const lines = [];
      await compileAndRun('puts("hello" + " " + "world")', { outputLines: lines });
      assert.strictEqual(lines[0], 'hello world');
    });

    it('str() converts integer to string', async () => {
      const lines = [];
      await compileAndRun('puts(str(42))', { outputLines: lines });
      assert.strictEqual(lines[0], '42');
    });

    it('str() + string concatenation', async () => {
      const lines = [];
      await compileAndRun('puts("answer: " + str(42))', { outputLines: lines });
      assert.strictEqual(lines[0], 'answer: 42');
    });

    it('string comparison ==', async () => {
      assert.strictEqual(await compileAndRun('"hello" == "hello"'), 1);
    });

    it('string comparison == false', async () => {
      assert.strictEqual(await compileAndRun('"hello" == "world"'), 0);
    });

    it('string comparison !=', async () => {
      assert.strictEqual(await compileAndRun('"a" != "b"'), 1);
    });

    it('string concat in loop', async () => {
      const lines = [];
      await compileAndRun(`
        let i = 0;
        while (i < 3) {
          puts("item " + str(i));
          i = i + 1;
        }
      `, { outputLines: lines });
      assert.deepStrictEqual(lines, ['item 0', 'item 1', 'item 2']);
    });

    it('string concat with multiple str() calls', async () => {
      const lines = [];
      await compileAndRun(`
        let a = 3;
        let b = 4;
        puts(str(a) + " + " + str(b) + " = " + str(a + b))
      `, { outputLines: lines });
      assert.strictEqual(lines[0], '3 + 4 = 7');
    });

    it('fibonacci with string output', async () => {
      const lines = [];
      await compileAndRun(`
        let fib = fn(n) {
          if (n <= 1) { n } else { fib(n - 1) + fib(n - 2) }
        };
        puts("fib(10) = " + str(fib(10)))
      `, { outputLines: lines });
      assert.strictEqual(lines[0], 'fib(10) = 55');
    });
  });

  describe('Closures', () => {
    it('simple closure capturing outer variable', async () => {
      assert.strictEqual(await compileAndRun(`
        let x = 10;
        let f = fn(y) { x + y };
        f(32)
      `), 42);
    });

    it('makeAdder (closure factory)', async () => {
      assert.strictEqual(await compileAndRun(`
        let makeAdder = fn(x) { fn(y) { x + y } };
        let add5 = makeAdder(5);
        add5(3)
      `), 8);
    });

    it('multiple closures from same factory', async () => {
      assert.strictEqual(await compileAndRun(`
        let makeAdder = fn(x) { fn(y) { x + y } };
        let add10 = makeAdder(10);
        let add20 = makeAdder(20);
        add10(5) + add20(5)
      `), 40);
    });

    it('closure capturing multiple variables', async () => {
      assert.strictEqual(await compileAndRun(`
        let a = 10;
        let b = 20;
        let f = fn(c) { a + b + c };
        f(12)
      `), 42);
    });

    it('counter closure', async () => {
      // Note: can't modify captured variables (value capture, not ref capture)
      // So this tests the capture at creation time
      assert.strictEqual(await compileAndRun(`
        let x = 5;
        let getX = fn() { x };
        getX()
      `), 5);
    });

    it('closure with function call inside', async () => {
      assert.strictEqual(await compileAndRun(`
        let double = fn(x) { x * 2 };
        let apply = fn(f, x) { f(x) };
        apply(double, 21)
      `), 42);
    });

    it('immediately invoked function', async () => {
      assert.strictEqual(await compileAndRun(`
        (fn(x) { x * 2 })(21)
      `), 42);
    });

    it('closure in arithmetic', async () => {
      assert.strictEqual(await compileAndRun(`
        let makeMultiplier = fn(factor) { fn(x) { factor * x } };
        let double = makeMultiplier(2);
        let triple = makeMultiplier(3);
        double(5) + triple(5)
      `), 25);
    });

    it('higher-order: apply function', async () => {
      assert.strictEqual(await compileAndRun(`
        let apply = fn(f, x) { f(x) };
        let inc = fn(x) { x + 1 };
        apply(inc, 41)
      `), 42);
    });
  });

  describe('Constant folding', () => {
    it('folds simple addition', async () => {
      const compiler = new WasmCompiler();
      const builder = compiler.compile('2 + 3');
      const binary = builder.build();
      const wat = disassemble(binary);
      // Main function should only have i32.const 5, no i32.add
      const mainFunc = wat.split(';; main')[1] || '';
      assert.ok(mainFunc.includes('i32.const 5'));
      assert.ok(!mainFunc.includes('i32.add'));
      assert.strictEqual(await compileAndRun('2 + 3'), 5);
    });

    it('folds complex arithmetic', async () => {
      assert.strictEqual(await compileAndRun('(10 + 20) * (3 - 1)'), 60);
    });

    it('folds comparisons', async () => {
      assert.strictEqual(await compileAndRun('5 > 3'), 1);
      assert.strictEqual(await compileAndRun('2 == 2'), 1);
      assert.strictEqual(await compileAndRun('1 != 1'), 0);
    });

    it('folds nested expressions', async () => {
      assert.strictEqual(await compileAndRun('1 + 2 + 3 + 4 + 5'), 15);
    });

    it('folds with negation', async () => {
      assert.strictEqual(await compileAndRun('-5 + 10'), 5);
    });

    it('folds modulo', async () => {
      assert.strictEqual(await compileAndRun('100 % 7'), 2);
    });

    it('does not fold when variables involved', async () => {
      // This should still work correctly even though x is not constant
      assert.strictEqual(await compileAndRun('let x = 5; x + 3'), 8);
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
