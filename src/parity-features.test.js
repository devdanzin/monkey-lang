// parity-features.test.js — Parity tests for new VM compiler features
// Tests: switch, f-strings, null literal, constant folding edge cases
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { Environment } from './object.js';

function bothMatch(input) {
  const i = monkeyEval(new Parser(new Lexer(input)).parseProgram(), new Environment());
  const c = new Compiler();
  c.compile(new Parser(new Lexer(input)).parseProgram());
  const vm = new VM(c.bytecode());
  vm.run();
  const v = vm.lastPoppedStackElem();
  const iStr = i?.inspect?.() ?? String(i);
  const vStr = v?.inspect?.() ?? String(v);
  assert.equal(iStr, vStr, `Parity mismatch for: ${input}\n  interp=${iStr} vm=${vStr}`);
  return v;
}

describe('Parity: Switch Expressions', () => {
  it('switch with matching case', () => {
    bothMatch('switch (2) { case 1: "one" case 2: "two" default: "other" }');
  });

  it('switch falls through to default', () => {
    bothMatch('switch (99) { case 1: "one" case 2: "two" default: "other" }');
  });

  it('switch with no value (condition form)', () => {
    bothMatch('let x = 5; switch { case (x > 10): "big" case (x > 3): "medium" default: "small" }');
  });

  it('switch result used in let', () => {
    bothMatch('let r = switch (3) { case 1: 10 case 2: 20 case 3: 30 default: 0 }; r * 2');
  });
});

describe('Parity: F-String Interpolation', () => {
  it('basic f-string with variable', () => {
    bothMatch('let x = 42; f"value: {x}"');
  });

  it('f-string with expression', () => {
    bothMatch('f"sum: {1 + 2 + 3}"');
  });

  it('f-string with string variable', () => {
    bothMatch('let name = "world"; f"hello {name}!"');
  });

  it('f-string with no interpolation', () => {
    bothMatch('f"just a string"');
  });

  it('f-string with multiple parts', () => {
    bothMatch('let a = 1; let b = 2; f"{a} + {b} = {a + b}"');
  });
});

describe('Parity: Null Literal', () => {
  it('null value', () => {
    bothMatch('null');
  });

  it('null in let', () => {
    bothMatch('let x = null; x');
  });

  it('null in if condition', () => {
    bothMatch('if (null) { 1 } else { 2 }');
  });

  it('null comparison', () => {
    bothMatch('null == null');
  });
});

describe('Parity: Constant Folding Correctness', () => {
  it('arithmetic folding', () => {
    bothMatch('1 + 2 * 3 - 4');
  });

  it('comparison folding', () => {
    bothMatch('if (1 > 2) { "yes" } else { "no" }');
  });

  it('negation folding', () => {
    bothMatch('-42');
  });

  it('string concatenation folding', () => {
    bothMatch('"hello" + " " + "world"');
  });

  it('folded value in complex expression', () => {
    bothMatch('let base = 10; base + 2 * 3');
  });
});

describe('Parity: Higher-Order Functions', () => {
  it('function composition', () => {
    bothMatch('let compose = fn(f, g) { fn(x) { f(g(x)) } }; compose(fn(x) { x * 2 }, fn(x) { x + 1 })(5)');
  });

  it('currying', () => {
    bothMatch('let curry_add = fn(a) { fn(b) { fn(c) { a + b + c } } }; curry_add(1)(2)(3)');
  });

  it('map implementation', () => {
    bothMatch(`
      let map = fn(arr, f) {
        let result = [];
        for (x in arr) { set result = push(result, f(x)) };
        result
      };
      map([1,2,3], fn(x) { x * x })
    `);
  });

  it('reduce implementation', () => {
    bothMatch(`
      let reduce = fn(arr, init, f) {
        let acc = init;
        for (x in arr) { set acc = f(acc, x) };
        acc
      };
      reduce([1,2,3,4,5], 0, fn(a, b) { a + b })
    `);
  });
});
