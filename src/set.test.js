// set.test.js — Set statement (variable mutation) tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment, MonkeyInteger, NULL } from './object.js';
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

describe('Set statement', () => {
  it('basic set in interpreter', () => {
    const r = runInterp('let x = 1; set x = 2; x');
    assert.equal(r.value, 2);
  });

  it('basic set in VM', () => {
    const r = runVM('let x = 1; set x = 2; x');
    assert.equal(r.value, 2);
  });

  it('set with expression', () => {
    const r = runVM('let x = 5; set x = x * 2 + 1; x');
    assert.equal(r.value, 11);
  });

  it('while loop with set (sum 1..10)', () => {
    const r = runVM(`
      let sum = 0;
      let i = 1;
      while (i < 11) {
        set sum = sum + i;
        set i = i + 1;
      }
      sum
    `);
    assert.equal(r.value, 55);
  });

  it('while loop with set (interpreter)', () => {
    const r = runInterp(`
      let sum = 0;
      let i = 1;
      while (i < 11) {
        set sum = sum + i;
        set i = i + 1;
      }
      sum
    `);
    assert.equal(r.value, 55);
  });

  it('while loop factorial', () => {
    const r = runVM(`
      let result = 1;
      let n = 5;
      while (n > 0) {
        set result = result * n;
        set n = n - 1;
      }
      result
    `);
    assert.equal(r.value, 120);
  });

  it('set inside function', () => {
    const r = runVM(`
      let counter = fn() {
        let x = 0;
        set x = x + 1;
        set x = x + 1;
        x
      };
      counter()
    `);
    assert.equal(r.value, 2);
  });

  it('while loop builds string', () => {
    const r = runVM(`
      let s = "";
      let i = 0;
      while (i < 3) {
        set s = s + "x";
        set i = i + 1;
      }
      len(s)
    `);
    assert.equal(r.value, 3);
  });

  it('parity: while+set same in both engines', () => {
    const input = `
      let x = 0;
      let i = 1;
      while (i < 6) {
        set x = x + i * i;
        set i = i + 1;
      }
      x
    `;
    const interp = runInterp(input);
    const vm = runVM(input);
    assert.equal(interp.value, vm.value);
    assert.equal(vm.value, 55); // 1 + 4 + 9 + 16 + 25 = 55
  });
});
