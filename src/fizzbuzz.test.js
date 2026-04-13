// fizzbuzz.test.js — FizzBuzz showcase using for/set/%
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment, MonkeyString, MonkeyArray } from './object.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function runInterp(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  return monkeyEval(p.parseProgram(), new Environment());
}

function runVM(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const c = new Compiler();
  c.compile(p.parseProgram());
  const vm = new VM(c.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

const fizzbuzzProgram = `
let result = [];
for (let i = 1; i < 16; set i = i + 1) {
  if (i % 15 == 0) {
    set result = push(result, "FizzBuzz");
  } else {
    if (i % 3 == 0) {
      set result = push(result, "Fizz");
    } else {
      if (i % 5 == 0) {
        set result = push(result, "Buzz");
      } else {
        set result = push(result, i);
      }
    }
  }
}
result
`;

const expected = [1, 2, "Fizz", 4, "Buzz", "Fizz", 7, 8, "Fizz", "Buzz", 11, "Fizz", 13, 14, "FizzBuzz"];

describe('FizzBuzz', () => {
  it('works in tree-walker', () => {
    const result = runInterp(fizzbuzzProgram);
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 15);
    for (let i = 0; i < expected.length; i++) {
      const el = result.elements[i];
      if (typeof expected[i] === 'string') {
        assert.ok(el instanceof MonkeyString, `Element ${i} should be string, got ${el.constructor.name}`);
        assert.equal(el.value, expected[i]);
      } else {
        assert.equal(el.value, expected[i]);
      }
    }
  });

  it('works in VM', () => {
    const result = runVM(fizzbuzzProgram);
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 15);
    for (let i = 0; i < expected.length; i++) {
      const el = result.elements[i];
      if (typeof expected[i] === 'string') {
        assert.ok(el instanceof MonkeyString, `Element ${i} should be string, got ${el.constructor.name}`);
        assert.equal(el.value, expected[i]);
      } else {
        assert.equal(el.value, expected[i]);
      }
    }
  });

  it('parity: both engines produce same result', () => {
    const interp = runInterp(fizzbuzzProgram);
    const vm = runVM(fizzbuzzProgram);
    assert.equal(interp.elements.length, vm.elements.length);
    for (let i = 0; i < interp.elements.length; i++) {
      assert.equal(interp.elements[i].inspect(), vm.elements[i].inspect());
    }
  });

  it('handles large FizzBuzz (1..100)', () => {
    const prog = fizzbuzzProgram.replace('i < 16', 'i < 101');
    const result = runVM(prog);
    assert.ok(result instanceof MonkeyArray);
    assert.equal(result.elements.length, 100);
    // Check specific values
    assert.equal(result.elements[14].inspect(), 'FizzBuzz'); // 15
    assert.equal(result.elements[29].inspect(), 'FizzBuzz'); // 30
    assert.equal(result.elements[99].inspect(), 'Buzz'); // 100 (div by 5 but not 3)
  });
});
