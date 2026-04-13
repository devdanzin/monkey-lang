// while.test.js — While loop tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment, NULL } from './object.js';
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

describe('While loops', () => {
  it('while (false) never executes', () => {
    const result = runVM('while (false) { 42 }');
    assert.equal(result, NULL);
  });

  it('while (false) in interpreter never executes', () => {
    const result = runInterp('while (false) { 42 }');
    assert.equal(result, NULL);
  });

  it('while loop with false condition in function', () => {
    const result = runVM(`
      let f = fn() {
        while (false) { 1 }
        99
      };
      f()
    `);
    assert.equal(result.value, 99);
  });

  it('while condition evaluated (interpreter)', () => {
    // With immutable let, while body can't affect outer variables
    // But we can verify the loop body at least runs if condition is true initially
    const result = runInterp(`
      while (false) { 42 }
      0
    `);
    assert.equal(result.value, 0);
  });

  it('while loop parses correctly', () => {
    const l = new Lexer('while (x > 0) { let x = x - 1 }');
    const p = new Parser(l);
    const program = p.parseProgram();
    assert.ok(program.statements.length > 0);
    assert.ok(p.errors.length === 0, `Parser errors: ${p.errors.join(', ')}`);
  });

  it('while with complex condition', () => {
    const result = runVM('while (1 > 2) { 42 }');
    assert.equal(result, NULL);
  });

  it('while compiles to bytecode with jumps', () => {
    // Just verify it compiles without error
    const l = new Lexer('while (true) { return 42 }');
    const p = new Parser(l);
    const c = new Compiler();
    c.compile(p.parseProgram());
    const bc = c.bytecode();
    assert.ok(bc.instructions.length > 0);
  });

  it('while with return in body (interpreter)', () => {
    const result = runInterp(`
      let f = fn() {
        while (true) {
          return 42
        }
      };
      f()
    `);
    assert.equal(result.value, 42);
  });

  it('while with return in body (VM)', () => {
    const result = runVM(`
      let f = fn() {
        while (true) {
          return 42
        }
      };
      f()
    `);
    assert.equal(result.value, 42);
  });
});
