// Monkey Language Compiler + VM Tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM, Closure } from './vm.js';
import { MonkeyInteger, MonkeyBoolean, MonkeyString, MonkeyNull, MonkeyArray, MonkeyHash, MonkeyError, NULL, TRUE, FALSE } from './object.js';
import { Opcodes, make, disassemble } from './code.js';

function parse(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  return parser.parseProgram();
}

function compileAndRun(input) {
  const program = parse(input);
  const compiler = new Compiler();
  const err = compiler.compile(program);
  if (err) throw new Error(`compiler error: ${err}`);
  const vm = new VM(compiler.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

function testIntegerObject(obj, expected) {
  assert.ok(obj instanceof MonkeyInteger, `expected MonkeyInteger, got ${obj?.constructor?.name}`);
  assert.equal(obj.value, expected);
}

function testBooleanObject(obj, expected) {
  assert.ok(obj instanceof MonkeyBoolean, `expected MonkeyBoolean, got ${obj?.constructor?.name}`);
  assert.equal(obj.value, expected);
}

function testStringObject(obj, expected) {
  assert.ok(obj instanceof MonkeyString, `expected MonkeyString, got ${obj?.constructor?.name}`);
  assert.equal(obj.value, expected);
}

function testNullObject(obj) {
  assert.equal(obj, NULL, `expected NULL, got ${obj?.inspect?.()}`);
}

// --- Code module tests ---
describe('Code', () => {
  it('make and disassemble OpConstant', () => {
    const ins = make(Opcodes.OpConstant, 65534);
    assert.equal(ins.length, 3);
    assert.equal(ins[0], Opcodes.OpConstant);
    assert.equal(ins[1], 0xFF);
    assert.equal(ins[2], 0xFE);
  });

  it('make OpAdd (no operands)', () => {
    const ins = make(Opcodes.OpAdd);
    assert.equal(ins.length, 1);
    assert.equal(ins[0], Opcodes.OpAdd);
  });

  it('make OpGetLocal (1-byte operand)', () => {
    const ins = make(Opcodes.OpGetLocal, 255);
    assert.equal(ins.length, 2);
    assert.equal(ins[1], 255);
  });

  it('make OpClosure (2-byte + 1-byte operand)', () => {
    const ins = make(Opcodes.OpClosure, 256, 5);
    assert.equal(ins.length, 4);
    assert.equal((ins[1] << 8) | ins[2], 256);
    assert.equal(ins[3], 5);
  });
});

// --- Integer arithmetic ---
describe('Integer Arithmetic', () => {
  const tests = [
    ['1', 1],
    ['2', 2],
    ['1 + 2', 3],
    ['1 - 2', -1],
    ['1 * 2', 2],
    ['4 / 2', 2],
    ['50 / 2 * 2 + 10 - 5', 55],
    ['5 + 5 + 5 + 5 - 10', 10],
    ['2 * 2 * 2 * 2 * 2', 32],
    ['5 * 2 + 10', 20],
    ['5 + 2 * 10', 25],
    ['5 * (2 + 10)', 60],
    ['-5', -5],
    ['-10', -10],
    ['-50 + 100 + -50', 0],
    ['(5 + 10 * 2 + 15 / 3) * 2 + -10', 50],
  ];

  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      testIntegerObject(compileAndRun(input), expected);
    });
  }
});

// --- Boolean expressions ---
describe('Boolean Expressions', () => {
  const tests = [
    ['true', true],
    ['false', false],
    ['1 < 2', true],
    ['1 > 2', false],
    ['1 < 1', false],
    ['1 > 1', false],
    ['1 == 1', true],
    ['1 != 1', false],
    ['1 == 2', false],
    ['1 != 2', true],
    ['true == true', true],
    ['false == false', true],
    ['true == false', false],
    ['true != false', true],
    ['false != true', true],
    ['(1 < 2) == true', true],
    ['(1 < 2) == false', false],
    ['(1 > 2) == true', false],
    ['(1 > 2) == false', true],
    ['!true', false],
    ['!false', true],
    ['!5', false],
    ['!!true', true],
    ['!!false', false],
    ['!!5', true],
  ];

  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      testBooleanObject(compileAndRun(input), expected);
    });
  }
});

// --- Conditionals ---
describe('Conditionals', () => {
  const intTests = [
    ['if (true) { 10 }', 10],
    ['if (true) { 10 } else { 20 }', 10],
    ['if (false) { 10 } else { 20 }', 20],
    ['if (1) { 10 }', 10],
    ['if (1 < 2) { 10 }', 10],
    ['if (1 < 2) { 10 } else { 20 }', 10],
    ['if (1 > 2) { 10 } else { 20 }', 20],
  ];
  for (const [input, expected] of intTests) {
    it(`${input} => ${expected}`, () => {
      testIntegerObject(compileAndRun(input), expected);
    });
  }

  const nullTests = [
    ['if (1 > 2) { 10 }'],
    ['if (false) { 10 }'],
  ];
  for (const [input] of nullTests) {
    it(`${input} => null`, () => {
      testNullObject(compileAndRun(input));
    });
  }
});

// --- Global let statements ---
describe('Global Let Statements', () => {
  const tests = [
    ['let one = 1; one', 1],
    ['let one = 1; let two = 2; one + two', 3],
    ['let one = 1; let two = one + one; one + two', 3],
  ];
  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      testIntegerObject(compileAndRun(input), expected);
    });
  }
});

// --- String expressions ---
describe('String Expressions', () => {
  it('string literal', () => {
    testStringObject(compileAndRun('"monkey"'), 'monkey');
  });
  it('string concatenation', () => {
    testStringObject(compileAndRun('"mon" + "key"'), 'monkey');
  });
  it('string * int repeats string', () => {
    testStringObject(compileAndRun('"abc" * 3'), 'abcabcabc');
  });
  it('int * string repeats string', () => {
    testStringObject(compileAndRun('3 * "abc"'), 'abcabcabc');
  });
  it('string * 0 returns empty string', () => {
    testStringObject(compileAndRun('"abc" * 0'), '');
  });
  it('string * 1 returns same string', () => {
    testStringObject(compileAndRun('"abc" * 1'), 'abc');
  });
  it('string * variable', () => {
    testStringObject(compileAndRun('let n = 4; "ha" * n'), 'hahahaha');
  });
  it('empty string * n', () => {
    testStringObject(compileAndRun('"" * 5'), '');
  });
});

describe('String Comparisons', () => {
  it('equal strings', () => {
    testBooleanObject(compileAndRun('"abc" == "abc"'), true);
  });
  it('unequal strings', () => {
    testBooleanObject(compileAndRun('"abc" == "def"'), false);
  });
  it('not equal: different strings', () => {
    testBooleanObject(compileAndRun('"abc" != "def"'), true);
  });
  it('not equal: same strings', () => {
    testBooleanObject(compileAndRun('"abc" != "abc"'), false);
  });
  it('greater than: true', () => {
    testBooleanObject(compileAndRun('"b" > "a"'), true);
  });
  it('greater than: false', () => {
    testBooleanObject(compileAndRun('"a" > "b"'), false);
  });
  it('less than: true', () => {
    testBooleanObject(compileAndRun('"a" < "b"'), true);
  });
  it('less than: false', () => {
    testBooleanObject(compileAndRun('"b" < "a"'), false);
  });
  it('lexicographic: longer string', () => {
    testBooleanObject(compileAndRun('"abc" < "abd"'), true);
  });
  it('empty string less than any', () => {
    testBooleanObject(compileAndRun('"" < "a"'), true);
  });
});

// --- Array literals ---
describe('Array Literals', () => {
  it('empty array', () => {
    const result = compileAndRun('[]');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 0);
  });
  it('array with elements', () => {
    const result = compileAndRun('[1, 2, 3]');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 3);
    testIntegerObject(result.elements[0], 1);
    testIntegerObject(result.elements[1], 2);
    testIntegerObject(result.elements[2], 3);
  });
  it('array with expressions', () => {
    const result = compileAndRun('[1 + 2, 3 * 4, 5 + 6]');
    assert.ok(result instanceof MonkeyArray);
    testIntegerObject(result.elements[0], 3);
    testIntegerObject(result.elements[1], 12);
    testIntegerObject(result.elements[2], 11);
  });
});

// --- Hash literals ---
describe('Hash Literals', () => {
  it('empty hash', () => {
    const result = compileAndRun('{}');
    assert.ok(result instanceof MonkeyHash);
    assert.equal(result.pairs.size, 0);
  });
  it('hash with integer keys', () => {
    const result = compileAndRun('{1: 2, 3: 4}');
    assert.ok(result instanceof MonkeyHash);
    assert.equal(result.pairs.size, 2);
  });
  it('hash with expressions', () => {
    const result = compileAndRun('{1: 2 + 3, 4: 5 * 6}');
    assert.ok(result instanceof MonkeyHash);
    const pair1 = result.pairs.get(1);
    testIntegerObject(pair1.value, 5);
    const pair2 = result.pairs.get(4);
    testIntegerObject(pair2.value, 30);
  });
});

// --- Index expressions ---
describe('Index Expressions', () => {
  const tests = [
    ['[1, 2, 3][1]', 2],
    ['[1, 2, 3][0 + 2]', 3],
    ['[[1, 1, 1]][0][0]', 1],
    ['{1: 1, 2: 2}[1]', 1],
    ['{1: 1, 2: 2}[2]', 2],
  ];
  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      testIntegerObject(compileAndRun(input), expected);
    });
  }

  it('array out of bounds => null', () => {
    testNullObject(compileAndRun('[1, 2, 3][99]'));
  });
  it('hash missing key => null', () => {
    testNullObject(compileAndRun('{1: 2}[0]'));
  });
});

// --- Functions ---
describe('Functions', () => {
  const tests = [
    ['let fivePlusTen = fn() { 5 + 10; }; fivePlusTen();', 15],
    ['let one = fn() { 1; }; let two = fn() { 2; }; one() + two()', 3],
    ['let a = fn() { 1 }; let b = fn() { a() + 1 }; let c = fn() { b() + 1 }; c();', 3],
    ['let earlyExit = fn() { return 99; 100; }; earlyExit();', 99],
    ['let earlyExit = fn() { return 99; return 100; }; earlyExit();', 99],
    ['let noReturn = fn() { }; noReturn();', null],
    ['let returnsOne = fn() { 1; }; let returnsOneReturner = fn() { returnsOne; }; returnsOneReturner()();', 1],
  ];
  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      const result = compileAndRun(input);
      if (expected === null) {
        testNullObject(result);
      } else {
        testIntegerObject(result, expected);
      }
    });
  }
});

// --- Functions with arguments ---
describe('Functions with Arguments', () => {
  const tests = [
    ['let identity = fn(a) { a; }; identity(4);', 4],
    ['let sum = fn(a, b) { a + b; }; sum(1, 2);', 3],
    ['let sum = fn(a, b) { let c = a + b; c; }; sum(1, 2);', 3],
    ['let sum = fn(a, b) { let c = a + b; c; }; sum(1, 2) + sum(3, 4);', 10],
    ['let globalNum = 10; let sum = fn(a, b) { let c = a + b; c + globalNum; }; let outer = fn() { sum(1, 2) + sum(3, 4) + globalNum; }; outer() + globalNum;', 50],
  ];
  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      testIntegerObject(compileAndRun(input), expected);
    });
  }
});

// --- Local bindings ---
describe('Local Bindings', () => {
  const tests = [
    ['let one = fn() { let one = 1; one }; one();', 1],
    ['let oneAndTwo = fn() { let one = 1; let two = 2; one + two; }; oneAndTwo();', 3],
    ['let oneAndTwo = fn() { let one = 1; let two = 2; one + two; }; let threeAndFour = fn() { let three = 3; let four = 4; three + four; }; oneAndTwo() + threeAndFour();', 10],
    ['let firstFoobar = fn() { let foobar = 50; foobar; }; let secondFoobar = fn() { let foobar = 100; foobar; }; firstFoobar() + secondFoobar();', 150],
  ];
  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      testIntegerObject(compileAndRun(input), expected);
    });
  }
});

// --- Builtins ---
describe('Builtins', () => {
  it('len("")', () => {
    testIntegerObject(compileAndRun('len("")'), 0);
  });
  it('len("four")', () => {
    testIntegerObject(compileAndRun('len("four")'), 4);
  });
  it('len([1, 2, 3])', () => {
    testIntegerObject(compileAndRun('len([1, 2, 3])'), 3);
  });
  it('first([1, 2, 3])', () => {
    testIntegerObject(compileAndRun('first([1, 2, 3])'), 1);
  });
  it('last([1, 2, 3])', () => {
    testIntegerObject(compileAndRun('last([1, 2, 3])'), 3);
  });
  it('rest([1, 2, 3])', () => {
    const result = compileAndRun('rest([1, 2, 3])');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 2);
    testIntegerObject(result.elements[0], 2);
    testIntegerObject(result.elements[1], 3);
  });
  it('push([], 1)', () => {
    const result = compileAndRun('push([], 1)');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 1);
    testIntegerObject(result.elements[0], 1);
  });
});

// --- Closures ---
describe('Closures', () => {
  const tests = [
    ['let newClosure = fn(a) { fn() { a; }; }; let closure = newClosure(99); closure();', 99],
    ['let newAdder = fn(a, b) { fn(c) { a + b + c }; }; let adder = newAdder(1, 2); adder(8);', 11],
    ['let newAdder = fn(a, b) { let c = a + b; fn(d) { c + d }; }; let adder = newAdder(1, 2); adder(8);', 11],
    ['let newAdderOuter = fn(a, b) { let c = a + b; fn(d) { let e = d + c; fn(f) { e + f; }; }; }; let newAdderInner = newAdderOuter(1, 2); let adder = newAdderInner(3); adder(8);', 14],
    // Global + closure mix
    ['let a = 1; let newAdderOuter = fn(b) { fn(c) { fn(d) { a + b + c + d }; }; }; let newAdderInner = newAdderOuter(2); let adder = newAdderInner(3); adder(8);', 14],
  ];
  for (const [input, expected] of tests) {
    it(`${input} => ${expected}`, () => {
      testIntegerObject(compileAndRun(input), expected);
    });
  }
});

// --- Recursive functions ---
describe('Recursive Functions', () => {
  it('recursive countdown', () => {
    const input = `
      let countDown = fn(x) {
        if (x == 0) { return 0; }
        countDown(x - 1);
      };
      countDown(1);
    `;
    testIntegerObject(compileAndRun(input), 0);
  });

  it('recursive fibonacci', () => {
    const input = `
      let fibonacci = fn(x) {
        if (x == 0) { return 0; }
        if (x == 1) { return 1; }
        fibonacci(x - 1) + fibonacci(x - 2);
      };
      fibonacci(15);
    `;
    testIntegerObject(compileAndRun(input), 610);
  });

  it('recursive closure in local scope', () => {
    const input = `
      let wrapper = fn() {
        let countDown = fn(x) {
          if (x == 0) { return 0; }
          countDown(x - 1);
        };
        countDown(1);
      };
      wrapper();
    `;
    testIntegerObject(compileAndRun(input), 0);
  });

  it('recursive fibonacci in local scope', () => {
    const input = `
      let wrapper = fn() {
        let fib = fn(x) {
          if (x == 0) { return 0; }
          if (x == 1) { return 1; }
          fib(x - 1) + fib(x - 2);
        };
        fib(10);
      };
      wrapper();
    `;
    testIntegerObject(compileAndRun(input), 55);
  });
});

describe('Constant Folding', () => {
  it('folds integer arithmetic', () => {
    testIntegerObject(compileAndRun('1 + 2'), 3);
    testIntegerObject(compileAndRun('2 * 3 + 4'), 10);
    testIntegerObject(compileAndRun('10 / 2 - 1'), 4);
  });

  it('folds nested constant expressions', () => {
    testIntegerObject(compileAndRun('(1 + 2) * (3 + 4)'), 21);
    testIntegerObject(compileAndRun('2 * 3 * 4'), 24);
  });

  it('folds prefix negation', () => {
    testIntegerObject(compileAndRun('-5'), -5);
    testIntegerObject(compileAndRun('-(1 + 2)'), -3);
  });

  it('folds constant comparisons', () => {
    assert.equal(compileAndRun('1 == 1'), TRUE);
    assert.equal(compileAndRun('1 != 2'), TRUE);
    assert.equal(compileAndRun('3 > 2'), TRUE);
    assert.equal(compileAndRun('2 < 3'), TRUE);
    assert.equal(compileAndRun('1 == 2'), FALSE);
  });

  it('folds string concatenation', () => {
    const result = compileAndRun('"hello" + " " + "world"');
    assert.ok(result instanceof MonkeyString);
    assert.equal(result.value, 'hello world');
  });

  it('emits fewer instructions for constant expressions', () => {
    // Verify that 1 + 2 produces a single OpConstant (value 3)
    // rather than OpConstant(1), OpConstant(2), OpAdd
    const program = parse('1 + 2');
    const compiler = new Compiler();
    compiler.compile(program);
    const bc = compiler.bytecode();
    // Should have: OpConstant(3), OpPop — 2 instructions
    assert.equal(bc.constants.length, 1);
    assert.ok(bc.constants[0] instanceof MonkeyInteger);
    assert.equal(bc.constants[0].value, 3);
  });

  it('does not fold when variables are involved', () => {
    // Should still work correctly with mixed constant/variable expressions
    testIntegerObject(compileAndRun('let x = 5; x + 1'), 6);
    testIntegerObject(compileAndRun('let x = 5; 1 + x'), 6);
  });

  it('division by zero is not folded', () => {
    // 1 / 0 should not be folded — let runtime handle it
    const program = parse('1 / 0');
    const compiler = new Compiler();
    compiler.compile(program);
    const bc = compiler.bytecode();
    // Should have 2 constants (1 and 0), not 1 folded constant
    assert.equal(bc.constants.length, 2);
  });
});

describe('Compound Assignment Operators', () => {
  it('plus-assign: x += 5', () => {
    testIntegerObject(compileAndRun('let x = 10; x += 5; x'), 15);
  });

  it('minus-assign: x -= 3', () => {
    testIntegerObject(compileAndRun('let x = 10; x -= 3; x'), 7);
  });

  it('multiply-assign: x *= 4', () => {
    testIntegerObject(compileAndRun('let x = 10; x *= 4; x'), 40);
  });

  it('divide-assign: x /= 2', () => {
    testIntegerObject(compileAndRun('let x = 10; x /= 2; x'), 5);
  });

  it('modulo-assign: x %= 3', () => {
    testIntegerObject(compileAndRun('let x = 10; x %= 3; x'), 1);
  });

  it('chained compound assignment', () => {
    testIntegerObject(compileAndRun('let x = 1; x += 2; x += 3; x'), 6);
  });

  it('compound assignment in while loop', () => {
    testIntegerObject(compileAndRun('let x = 0; let i = 0; while (i < 5) { x += i; i = i + 1; }; x'), 10);
  });

  it('compound assign returns the new value', () => {
    testIntegerObject(compileAndRun('let x = 5; let y = x += 3; y'), 8);
  });

  it('compound assign with expression on right side', () => {
    testIntegerObject(compileAndRun('let x = 10; let y = 3; x += y * 2; x'), 16);
  });

  it('multiple different compound operators', () => {
    testIntegerObject(compileAndRun('let x = 100; x += 50; x -= 30; x *= 2; x /= 4; x'), 60);
  });
});

describe('For Loops', () => {
  it('basic for loop sum', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 0; i < 10; i += 1) { s += i; }; s'), 45);
  });

  it('for loop with multiplication', () => {
    testIntegerObject(compileAndRun('let s = 1; for (let i = 0; i < 10; i += 1) { s *= 2; }; s'), 1024);
  });

  it('for loop counting down', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 10; i > 0; i -= 1) { s += i; }; s'), 55);
  });

  it('for loop with step > 1', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 0; i < 10; i += 2) { s += i; }; s'), 20);
  });

  it('for loop zero iterations', () => {
    testIntegerObject(compileAndRun('let s = 99; for (let i = 0; i < 0; i += 1) { s = 0; }; s'), 99);
  });

  it('nested for loops', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 0; i < 3; i += 1) { for (let j = 0; j < 3; j += 1) { s += 1; } }; s'), 9);
  });

  it('for loop building array', () => {
    const result = compileAndRun('let a = []; for (let i = 0; i < 5; i += 1) { a = push(a, i); }; a');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 5);
    testIntegerObject(result.elements[4], 4);
  });

  it('for loop evaluates to null', () => {
    const result = compileAndRun('for (let i = 0; i < 3; i += 1) { 1 }');
    assert.ok(result instanceof MonkeyNull);
  });
});

describe('For-In Iteration', () => {
  it('sum array elements', () => {
    testIntegerObject(compileAndRun('let s = 0; for (x in [1, 2, 3, 4, 5]) { s += x; }; s'), 15);
  });

  it('iterate over variable array', () => {
    testIntegerObject(compileAndRun('let a = [10, 20, 30]; let s = 0; for (x in a) { s += x; }; s'), 60);
  });

  it('iterate over string characters', () => {
    testStringObject(compileAndRun('let s = ""; for (c in "hi") { s = s + c + "-"; }; s'), 'h-i-');
  });

  it('empty array', () => {
    testIntegerObject(compileAndRun('let s = 99; for (x in []) { s = 0; }; s'), 99);
  });

  it('nested for-in', () => {
    testIntegerObject(compileAndRun('let s = 0; for (a in [[1,2],[3,4]]) { for (x in a) { s += x; } }; s'), 10);
  });

  it('for-in with function call', () => {
    testIntegerObject(compileAndRun('let s = 0; let double = fn(x) { x * 2 }; for (x in [1, 2, 3]) { s += double(x); }; s'), 12);
  });

  it('for-in evaluates to null', () => {
    const result = compileAndRun('for (x in [1, 2, 3]) { x }');
    assert.ok(result instanceof MonkeyNull);
  });
});

describe('Negative Indexing', () => {
  it('array[-1] returns last element', () => {
    testIntegerObject(compileAndRun('[1, 2, 3][-1]'), 3);
  });
  it('array[-2] returns second to last', () => {
    testIntegerObject(compileAndRun('[10, 20, 30][-2]'), 20);
  });
  it('array[-3] returns first element', () => {
    testIntegerObject(compileAndRun('[10, 20, 30][-3]'), 10);
  });
  it('array[-4] out of bounds returns null', () => {
    const result = compileAndRun('[1, 2, 3][-4]');
    assert.ok(result instanceof MonkeyNull);
  });
  it('string[-1] returns last character', () => {
    testStringObject(compileAndRun('"hello"[-1]'), 'o');
  });
  it('string[-2] returns second to last', () => {
    testStringObject(compileAndRun('"hello"[-2]'), 'l');
  });
  it('negative index with variable', () => {
    testIntegerObject(compileAndRun('let a = [1, 2, 3]; let i = -1; a[i]'), 3);
  });
});

describe('Break and Continue', () => {
  it('break exits while loop', () => {
    testIntegerObject(compileAndRun('let s = 0; let i = 0; while (i < 10) { if (i == 5) { break; } s += i; i += 1; }; s'), 10);
  });

  it('continue skips iteration in for loop', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 0; i < 10; i += 1) { if (i % 2 == 0) { continue; } s += i; }; s'), 25);
  });

  it('break exits for loop', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 0; i < 100; i += 1) { if (i == 5) { break; } s += i; }; s'), 10);
  });

  it('break exits for-in loop', () => {
    testIntegerObject(compileAndRun('let s = 0; for (x in [1,2,3,4,5]) { if (x == 3) { break; } s += x; }; s'), 3);
  });

  it('continue in for-in loop', () => {
    testIntegerObject(compileAndRun('let s = 0; for (x in [1,2,3,4,5]) { if (x == 3) { continue; } s += x; }; s'), 12);
  });

  it('continue in while loop', () => {
    testIntegerObject(compileAndRun('let s = 0; let i = 0; while (i < 10) { i += 1; if (i % 2 == 0) { continue; } s += i; }; s'), 25);
  });

  it('nested break only exits inner loop', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 0; i < 3; i += 1) { for (let j = 0; j < 10; j += 1) { if (j == 2) { break; } s += 1; } }; s'), 6);
  });

  it('break with loop evaluating to null', () => {
    const result = compileAndRun('while (true) { break; }');
    assert.ok(result instanceof MonkeyNull);
  });
});

describe('String Interpolation (Template Literals)', () => {
  it('simple variable interpolation', () => {
    testStringObject(compileAndRun('let name = "world"; `hello ${name}`'), 'hello world');
  });
  it('integer interpolation', () => {
    testStringObject(compileAndRun('let x = 42; `the answer is ${x}`'), 'the answer is 42');
  });
  it('no interpolation', () => {
    testStringObject(compileAndRun('`plain string`'), 'plain string');
  });
  it('expression interpolation', () => {
    testStringObject(compileAndRun('let a = 3; let b = 4; `${a} + ${b} = ${a + b}`'), '3 + 4 = 7');
  });
  it('function call in interpolation', () => {
    testStringObject(compileAndRun('let double = fn(x) { x * 2 }; `doubled: ${double(5)}`'), 'doubled: 10');
  });
  it('empty template', () => {
    testStringObject(compileAndRun('``'), '');
  });
  it('boolean interpolation', () => {
    testStringObject(compileAndRun('`is true: ${true}`'), 'is true: true');
  });
  it('nested interpolation in loop', () => {
    testStringObject(compileAndRun('let s = ""; for (let i = 0; i < 3; i += 1) { s = s + `${i} `; }; s'), '0 1 2 ');
  });
});

describe('Escape Sequences', () => {
  it('newline escape', () => {
    testStringObject(compileAndRun('"hello\\nworld"'), 'hello\nworld');
  });
  it('tab escape', () => {
    testStringObject(compileAndRun('"col1\\tcol2"'), 'col1\tcol2');
  });
  it('backslash escape', () => {
    testStringObject(compileAndRun('"path\\\\to\\\\file"'), 'path\\to\\file');
  });
  it('quote escape', () => {
    testStringObject(compileAndRun('"say \\"hello\\""'), 'say "hello"');
  });
  it('multiple escapes', () => {
    testStringObject(compileAndRun('"a\\nb\\tc"'), 'a\nb\tc');
  });
  it('escape in template literal', () => {
    testStringObject(compileAndRun('`line1\\nline2`'), 'line1\nline2');
  });
  it('newline in string length', () => {
    testIntegerObject(compileAndRun('len("a\\nb")'), 3);
  });
});

describe('Array Mutation', () => {
  it('set element by index', () => {
    const result = compileAndRun('let a = [1, 2, 3]; a[0] = 10; a');
    assert.ok(result instanceof MonkeyArray);
    testIntegerObject(result.elements[0], 10);
    testIntegerObject(result.elements[1], 2);
  });
  it('set element with negative index', () => {
    const result = compileAndRun('let a = [1, 2, 3]; a[-1] = 99; a');
    assert.ok(result instanceof MonkeyArray);
    testIntegerObject(result.elements[2], 99);
  });
  it('swap elements', () => {
    const result = compileAndRun('let a = [10, 20]; let temp = a[0]; a[0] = a[1]; a[1] = temp; a');
    assert.ok(result instanceof MonkeyArray);
    testIntegerObject(result.elements[0], 20);
    testIntegerObject(result.elements[1], 10);
  });
  it('bubble sort with mutation', () => {
    const result = compileAndRun(`
      let a = [5, 3, 1, 4, 2];
      let n = len(a);
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n - i - 1; j += 1) {
          if (a[j] > a[j + 1]) {
            let temp = a[j];
            a[j] = a[j + 1];
            a[j + 1] = temp;
          }
        }
      }
      a
    `);
    assert.ok(result instanceof MonkeyArray);
    for (let i = 0; i < 5; i++) {
      testIntegerObject(result.elements[i], i + 1);
    }
  });
  it('assignment returns value', () => {
    testIntegerObject(compileAndRun('let a = [0, 0]; let x = a[0] = 42; x'), 42);
  });
  it('out of bounds is no-op', () => {
    const result = compileAndRun('let a = [1, 2]; a[5] = 99; a');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 2);
  });
});

describe('Compound Index Assignment', () => {
  it('arr[i] += val', () => {
    const result = compileAndRun('let a = [1, 2, 3]; a[0] += 10; a');
    assert.ok(result instanceof MonkeyArray);
    testIntegerObject(result.elements[0], 11);
  });
  it('arr[i] -= val', () => {
    const result = compileAndRun('let a = [10, 20, 30]; a[1] -= 5; a');
    testIntegerObject(result.elements[1], 15);
  });
  it('arr[i] *= val', () => {
    const result = compileAndRun('let a = [1, 2, 3]; a[-1] *= 10; a');
    testIntegerObject(result.elements[2], 30);
  });
  it('compound index in loop', () => {
    const result = compileAndRun('let a = [0, 0, 0]; for (let i = 0; i < 3; i += 1) { a[i] += i * 10; } a');
    testIntegerObject(result.elements[0], 0);
    testIntegerObject(result.elements[1], 10);
    testIntegerObject(result.elements[2], 20);
  });
});

describe('Else-If Chains', () => {
  it('basic else-if', () => {
    testStringObject(compileAndRun('let x = 15; if (x > 20) { "big" } else if (x > 10) { "medium" } else { "small" }'), 'medium');
  });
  it('first branch taken', () => {
    testStringObject(compileAndRun('let x = 25; if (x > 20) { "big" } else if (x > 10) { "medium" } else { "small" }'), 'big');
  });
  it('else branch taken', () => {
    testStringObject(compileAndRun('let x = 5; if (x > 20) { "big" } else if (x > 10) { "medium" } else { "small" }'), 'small');
  });
  it('three-way else-if chain', () => {
    testStringObject(compileAndRun('let x = 3; if (x == 1) { "one" } else if (x == 2) { "two" } else if (x == 3) { "three" } else { "other" }'), 'three');
  });
  it('else-if without final else', () => {
    const result = compileAndRun('let x = 5; if (x > 10) { "big" } else if (x > 3) { "medium" }');
    testStringObject(result, 'medium');
  });
  it('else-if in function', () => {
    testStringObject(compileAndRun('let grade = fn(score) { if (score >= 90) { "A" } else if (score >= 80) { "B" } else if (score >= 70) { "C" } else { "F" } }; grade(85)'), 'B');
  });
});

describe('Default Function Parameters', () => {
  it('use default when arg not provided', () => {
    testIntegerObject(compileAndRun('let add = fn(a, b = 10) { a + b }; add(5)'), 15);
  });
  it('override default with explicit arg', () => {
    testIntegerObject(compileAndRun('let add = fn(a, b = 10) { a + b }; add(5, 20)'), 25);
  });
  it('string default', () => {
    testStringObject(compileAndRun('let greet = fn(name, greeting = "hello") { greeting + " " + name }; greet("world")'), 'hello world');
  });
  it('multiple defaults', () => {
    testIntegerObject(compileAndRun('let f = fn(x, y = 1, z = 2) { x + y + z }; f(10)'), 13);
  });
  it('partial defaults', () => {
    testIntegerObject(compileAndRun('let f = fn(x, y = 1, z = 2) { x + y + z }; f(10, 20)'), 32);
  });
  it('all args provided', () => {
    testIntegerObject(compileAndRun('let f = fn(x, y = 1, z = 2) { x + y + z }; f(10, 20, 30)'), 60);
  });
  it('expression as default', () => {
    testIntegerObject(compileAndRun('let f = fn(x, y = 2 * 3) { x + y }; f(1)'), 7);
  });

});

describe('Array and String Slicing', () => {
  it('arr[1:3]', () => {
    const result = compileAndRun('[1,2,3,4,5][1:3]');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 2);
    testIntegerObject(result.elements[0], 2);
    testIntegerObject(result.elements[1], 3);
  });
  it('arr[2:]', () => {
    const result = compileAndRun('[1,2,3,4,5][2:]');
    assert.equal(result.elements.length, 3);
    testIntegerObject(result.elements[0], 3);
  });
  it('arr[:3]', () => {
    const result = compileAndRun('[1,2,3,4,5][:3]');
    assert.equal(result.elements.length, 3);
    testIntegerObject(result.elements[2], 3);
  });
  it('arr[-2:]', () => {
    const result = compileAndRun('[1,2,3,4,5][-2:]');
    assert.equal(result.elements.length, 2);
    testIntegerObject(result.elements[0], 4);
  });
  it('str[1:3]', () => {
    testStringObject(compileAndRun('"hello"[1:3]'), 'el');
  });
  it('str[:2]', () => {
    testStringObject(compileAndRun('"hello"[:2]'), 'he');
  });
  it('str[-3:]', () => {
    testStringObject(compileAndRun('"hello"[-3:]'), 'llo');
  });
  it('empty slice', () => {
    const result = compileAndRun('[1,2,3][2:2]');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 0);
  });
  it('slice variable', () => {
    const result = compileAndRun('let a = [10,20,30,40]; a[1:3]');
    assert.equal(result.elements.length, 2);
    testIntegerObject(result.elements[0], 20);
  });
  it('null literal keyword', () => {
    const result = compileAndRun('null');
    assert.ok(result instanceof MonkeyNull);
  });
  it('null equality', () => {
    testBooleanObject(compileAndRun('null == null'), true);
  });
  it('null inequality with int', () => {
    testBooleanObject(compileAndRun('null == 5'), false);
  });
});

describe('Ternary Operator', () => {
  it('true condition', () => {
    testIntegerObject(compileAndRun('true ? 1 : 2'), 1);
  });
  it('false condition', () => {
    testIntegerObject(compileAndRun('false ? 1 : 2'), 2);
  });
  it('comparison condition', () => {
    testStringObject(compileAndRun('5 > 3 ? "yes" : "no"'), 'yes');
  });
  it('ternary with expressions', () => {
    testIntegerObject(compileAndRun('let x = 10; x > 5 ? x * 2 : x'), 20);
  });
  it('nested ternary', () => {
    testStringObject(compileAndRun('let x = 2; x == 1 ? "one" : x == 2 ? "two" : "other"'), 'two');
  });
  it('ternary in function', () => {
    testIntegerObject(compileAndRun('let abs = fn(x) { x >= 0 ? x : 0 - x }; abs(-5)'), 5);
  });
  it('ternary with null', () => {
    testIntegerObject(compileAndRun('let x = null; x == null ? 42 : 0'), 42);
  });
});

describe('String Builtins', () => {
  it('upper', () => {
    testStringObject(compileAndRun('upper("hello")'), 'HELLO');
  });
  it('lower', () => {
    testStringObject(compileAndRun('lower("HELLO")'), 'hello');
  });
  it('indexOf string', () => {
    testIntegerObject(compileAndRun('indexOf("hello world", "world")'), 6);
  });
  it('indexOf not found', () => {
    testIntegerObject(compileAndRun('indexOf("hello", "xyz")'), -1);
  });
  it('indexOf array', () => {
    testIntegerObject(compileAndRun('indexOf([10,20,30], 20)'), 1);
  });
  it('startsWith', () => {
    testBooleanObject(compileAndRun('startsWith("hello", "hel")'), true);
  });
  it('endsWith', () => {
    testBooleanObject(compileAndRun('endsWith("hello", "llo")'), true);
  });
  it('char', () => {
    testStringObject(compileAndRun('char(65)'), 'A');
  });
  it('ord', () => {
    testIntegerObject(compileAndRun('ord("A")'), 65);
  });
  it('split', () => {
    const result = compileAndRun('split("a,b,c", ",")');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 3);
    testStringObject(result.elements[0], 'a');
  });
  it('join', () => {
    testStringObject(compileAndRun('join(["a","b","c"], "-")'), 'a-b-c');
  });
  it('trim', () => {
    testStringObject(compileAndRun('trim("  hello  ")'), 'hello');
  });
  it('replace', () => {
    testStringObject(compileAndRun('replace("hello world", "world", "monkey")'), 'hello monkey');
  });
});

describe('Mutable Closures', () => {
  it('counter pattern', () => {
    testIntegerObject(compileAndRun('let f = fn() { let c = 0; fn() { c = c + 1; c } }; let counter = f(); counter(); counter(); counter()'), 3);
  });
  it('accumulator', () => {
    testIntegerObject(compileAndRun('let f = fn() { let sum = 0; fn(x) { sum = sum + x; sum } }; let acc = f(); acc(10); acc(20); acc(30)'), 60);
  });
});

describe('Hash Mutation', () => {
  it('set new key', () => {
    testIntegerObject(compileAndRun('let h = {"a": 1}; h["b"] = 2; h["b"]'), 2);
  });
  it('update existing key', () => {
    testIntegerObject(compileAndRun('let h = {"a": 1}; h["a"] = 42; h["a"]'), 42);
  });
});

describe('Else-If Edge Cases', () => {
  it('else-if without final else', () => {
    const result = compileAndRun('let x = 99; if (x == 1) { "one" } else if (x == 2) { "two" }');
    assert.ok(result instanceof MonkeyNull);
  });
});

describe('Comprehensive Feature Integration', () => {
  it('fizzbuzz with ternary and for loop', () => {
    testStringObject(compileAndRun(`
      let fizzbuzz = fn(n) {
        n % 15 == 0 ? "FizzBuzz" :
        n % 3 == 0 ? "Fizz" :
        n % 5 == 0 ? "Buzz" :
        str(n)
      };
      fizzbuzz(15)
    `), 'FizzBuzz');
  });
  it('map with for-in and template', () => {
    testStringObject(compileAndRun(`
      let result = [];
      for (x in [1, 2, 3]) {
        result = push(result, \`item-\${x}\`);
      }
      join(result, ",")
    `), 'item-1,item-2,item-3');
  });
  it('slice + for-in + break', () => {
    testIntegerObject(compileAndRun(`
      let data = [10, 20, 30, 40, 50];
      let s = 0;
      for (x in data[1:4]) {
        if (x == 40) { break; }
        s += x;
      }
      s
    `), 50);
  });
  it('default params + ternary', () => {
    testIntegerObject(compileAndRun(`
      let clamp = fn(x, lo = 0, hi = 100) {
        x < lo ? lo : x > hi ? hi : x
      };
      clamp(150)
    `), 100);
  });
  it('recursive quicksort verification', () => {
    const result = compileAndRun(`
      let swap = fn(a, i, j) { let t = a[i]; a[i] = a[j]; a[j] = t; };
      let partition = fn(a, lo, hi) {
        let p = a[hi]; let i = lo;
        for (let j = lo; j < hi; j += 1) {
          if (a[j] <= p) { swap(a, i, j); i += 1; }
        }
        swap(a, i, hi); i
      };
      let qs = fn(a, lo, hi) {
        if (lo < hi) { let p = partition(a, lo, hi); qs(a, lo, p-1); qs(a, p+1, hi); }
      };
      let a = [5,3,8,1,9,2,7,4,6];
      qs(a, 0, len(a)-1);
      a[0] * 100 + a[4] * 10 + a[8]
    `);
    testIntegerObject(result, 159); // 1*100 + 5*10 + 9 = 159
  });
});

describe('Postfix Increment/Decrement', () => {
  it('i++ increments', () => {
    testIntegerObject(compileAndRun('let i = 0; i++; i++; i++; i'), 3);
  });
  it('i-- decrements', () => {
    testIntegerObject(compileAndRun('let i = 10; i--; i--; i'), 8);
  });
  it('i++ in for loop', () => {
    testIntegerObject(compileAndRun('let s = 0; for (let i = 0; i < 10; i++) { s += i; }; s'), 45);
  });
  it('i++ returns new value', () => {
    testIntegerObject(compileAndRun('let i = 5; let j = i++; j'), 6);
  });
  it('i-- in while loop', () => {
    testIntegerObject(compileAndRun('let i = 5; while (i > 0) { i--; } i'), 0);
  });
});

describe('Hash Builtins', () => {
  it('keys', () => {
    const result = compileAndRun('keys({"a": 1, "b": 2, "c": 3})');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 3);
  });
  it('values', () => {
    const result = compileAndRun('values({"x": 10, "y": 20})');
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 2);
  });
  it('abs positive', () => {
    testIntegerObject(compileAndRun('abs(42)'), 42);
  });
  it('abs negative', () => {
    testIntegerObject(compileAndRun('abs(-42)'), 42);
  });
});

describe('Match Expression', () => {
  it('matches first arm', () => {
    testStringObject(compileAndRun('match (1) { 1 => "one", 2 => "two", _ => "other" }'), 'one');
  });
  it('matches second arm', () => {
    testStringObject(compileAndRun('match (2) { 1 => "one", 2 => "two", _ => "other" }'), 'two');
  });
  it('matches wildcard', () => {
    testStringObject(compileAndRun('match (99) { 1 => "one", 2 => "two", _ => "other" }'), 'other');
  });
  it('matches string', () => {
    testIntegerObject(compileAndRun('match ("hello") { "hi" => 1, "hello" => 2, _ => 3 }'), 2);
  });
  it('match in function', () => {
    testStringObject(compileAndRun('let day = fn(n) { match (n) { 1 => "Mon", 2 => "Tue", 3 => "Wed", _ => "?" } }; day(2)'), 'Tue');
  });
  it('match with expressions', () => {
    testIntegerObject(compileAndRun('let x = 5; match (x * 2) { 8 => 1, 10 => 2, 12 => 3, _ => 0 }'), 2);
  });
  it('match without wildcard returns null', () => {
    const result = compileAndRun('match (99) { 1 => "one", 2 => "two" }');
    assert.ok(result instanceof MonkeyNull);
  });
  it('match with boolean', () => {
    testStringObject(compileAndRun('match (true) { false => "no", true => "yes" }'), 'yes');
  });
});
