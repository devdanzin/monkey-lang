// parity-loops.test.js — Loop parity tests: VM vs tree-walker evaluator
// Tests: break/continue, for-in, nested loops, closures, functions, edge cases
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { Environment, NULL } from './object.js';

function runInterp(input) {
  return monkeyEval(new Parser(new Lexer(input)).parseProgram(), new Environment());
}

function runVM(input) {
  const c = new Compiler();
  c.compile(new Parser(new Lexer(input)).parseProgram());
  const vm = new VM(c.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

function bothMatch(input) {
  const i = runInterp(input);
  const v = runVM(input);
  const iStr = i?.inspect?.() ?? String(i);
  const vStr = v?.inspect?.() ?? String(v);
  assert.equal(iStr, vStr, `Parity mismatch for: ${input}\n  interp=${iStr} vm=${vStr}`);
  return v;
}

describe('Loop Parity — Break/Continue', () => {
  it('for-loop break stops at i==5', () => {
    bothMatch('let s = 0; for (let i = 0; i < 10; set i = i + 1) { if (i == 5) { break; } set s = s + i; } s');
  });

  it('for-loop continue skips i==2', () => {
    bothMatch('let s = 0; for (let i = 0; i < 5; set i = i + 1) { if (i == 2) { continue; } set s = s + i; } s');
  });

  it('while break', () => {
    bothMatch('let x = 0; while (x < 10) { if (x == 3) { break; } set x = x + 1; } x');
  });

  it('while continue', () => {
    bothMatch('let s = 0; let i = 0; while (i < 5) { set i = i + 1; if (i == 3) { continue; } set s = s + i; } s');
  });

  it('do-while break', () => {
    bothMatch('let x = 0; do { set x = x + 1; if (x == 3) { break; } } while (x < 10); x');
  });

  it('break inside while(true)', () => {
    bothMatch('let x = 0; while (true) { set x = x + 1; if (x == 5) { break; } } x');
  });

  it('break with early check', () => {
    bothMatch('let x = 0; for (let i = 0; i < 100; set i = i + 1) { if (i == 0) { break; } set x = 999; } x');
  });
});

describe('Loop Parity — Nested Loops', () => {
  it('nested for with inner break', () => {
    bothMatch('let s = 0; for (let i = 0; i < 3; set i = i + 1) { for (let j = 0; j < 3; set j = j + 1) { if (j == 1) { break; } set s = s + 1; } } s');
  });

  it('nested for with inner continue', () => {
    bothMatch('let s = 0; for (let i = 0; i < 3; set i = i + 1) { for (let j = 0; j < 3; set j = j + 1) { if (j == 1) { continue; } set s = s + 1; } } s');
  });

  it('nested 3-deep with innermost break', () => {
    bothMatch('let r = 0; for (let i = 0; i < 2; set i = i + 1) { for (let j = 0; j < 2; set j = j + 1) { for (let k = 0; k < 10; set k = k + 1) { if (k == 2) { break; } set r = r + 1; } } } r');
  });

  it('outer break does not affect inner', () => {
    bothMatch('let s = 0; for (let i = 0; i < 5; set i = i + 1) { if (i == 2) { break; } for (let j = 0; j < 3; set j = j + 1) { set s = s + 1; } } s');
  });
});

describe('Loop Parity — For-In', () => {
  it('basic for-in', () => {
    bothMatch('let total = 0; for (x in [1,2,3]) { set total = total + x; } total');
  });

  it('for-in return value', () => {
    bothMatch('for (x in [10,20,30]) { x }');
  });

  it('for-in with break', () => {
    bothMatch('let s = 0; for (x in [1,2,3,4,5]) { if (x > 3) { break; } set s = s + x; } s');
  });

  it('for-in empty array', () => {
    bothMatch('let s = 0; for (x in []) { set s = 999; } s');
  });

  it('for-in single element', () => {
    bothMatch('for (x in [42]) { x }');
  });

  it('for-in with mutation', () => {
    bothMatch('let a = []; for (x in [1,2,3]) { set a = push(a, x * x); } a');
  });
});

describe('Loop Parity — Loops in Functions', () => {
  it('for-loop sum in function', () => {
    bothMatch('let f = fn() { let s = 0; for (let i = 0; i < 5; set i = i + 1) { set s = s + i; } s }; f()');
  });

  it('for-in in function', () => {
    bothMatch('let sum = fn(arr) { let t = 0; for (x in arr) { set t = t + x; } t }; sum([10, 20, 30])');
  });

  it('while in function', () => {
    bothMatch('let f = fn() { let x = 0; while (x < 5) { set x = x + 1; } x }; f()');
  });

  it('early return from for-loop', () => {
    bothMatch('let f = fn() { for (let i = 0; i < 100; set i = i + 1) { if (i == 7) { return i; } } 999 }; f()');
  });

  it('early return from for-in', () => {
    bothMatch('let f = fn() { for (x in [1,2,3,4,5]) { if (x == 3) { return x * 10; } } 0 }; f()');
  });

  it('early return from while', () => {
    bothMatch('let f = fn() { let i = 0; while (true) { set i = i + 1; if (i == 4) { return i; } } }; f()');
  });

  it('nested loops in function', () => {
    bothMatch('let f = fn() { let s = 0; for (let i = 0; i < 3; set i = i + 1) { for (let j = 0; j < 3; set j = j + 1) { set s = s + 1; } } s }; f()');
  });
});

describe('Loop Parity — Closures and Loops', () => {
  it('closure captures loop variable copy', () => {
    bothMatch('let fns = []; for (let i = 0; i < 3; set i = i + 1) { let x = i; set fns = push(fns, fn() { x }); } fns[0]() + fns[1]() + fns[2]()');
  });

  it('closure in for-in', () => {
    bothMatch('let fns = []; for (x in [10,20,30]) { let v = x; set fns = push(fns, fn() { v }); } fns[2]()');
  });

  // Note: 'set' on free (closure) variables is not supported in VM compiler yet
  // The evaluator handles it, but the compiler throws "cannot set FREE variable"
  // This is a known limitation tracked for future work
  it('closure reads captured variable', () => {
    bothMatch('let f = fn() { let x = 42; let g = fn() { x }; g() }; f()');
  });
});

describe('Loop Parity — Return Values', () => {
  it('for-loop body expression return', () => {
    bothMatch('for (let i = 0; i < 3; set i = i + 1) { i }');
  });

  it('while body expression return', () => {
    bothMatch('let x = 0; while (x < 3) { set x = x + 1; x }');
  });

  it('empty while returns null', () => {
    bothMatch('while (false) { 1 }');
  });

  it('for-in body expression return', () => {
    bothMatch('for (x in [1,2,3]) { x * 10 }');
  });

  it('for-in empty returns null', () => {
    bothMatch('for (x in []) { x }');
  });

  it('set-only body loop (no expression value)', () => {
    bothMatch('let x = 0; while (x < 3) { set x = x + 1; } x');
  });

  it('set-only for body', () => {
    bothMatch('let s = 0; for (let i = 0; i < 3; set i = i + 1) { set s = s + i; } s');
  });
});
