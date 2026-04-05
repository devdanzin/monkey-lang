// compiler-advanced.test.js — More compiler/evaluate tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Op, Chunk, VM, Compiler, evaluate } from './index.js';

const lit = (value) => ({ tag: 'lit', value });
const bin = (op, left, right) => ({ tag: 'binop', op, left, right });
const vr = (name) => ({ tag: 'var', name });
const letExpr = (name, value, body) => ({ tag: 'let', name, value, body });
const ifExpr = (cond, then, els) => ({ tag: 'if', cond, then, else: els });
const lam = (param, body) => ({ tag: 'lam', param, body });
const app = (fn, arg) => ({ tag: 'app', fn, arg });

describe('Compiler Advanced', () => {
  it('integer literals', () => {
    assert.equal(evaluate(lit(0)), 0);
    assert.equal(evaluate(lit(1)), 1);
    assert.equal(evaluate(lit(-1)), -1);
    assert.equal(evaluate(lit(999999)), 999999);
  });

  it('boolean literals', () => {
    assert.equal(evaluate(lit(true)), true);
    assert.equal(evaluate(lit(false)), false);
  });

  it('string literals', () => {
    assert.equal(evaluate(lit('hello')), 'hello');
    assert.equal(evaluate(lit('')), '');
  });

  it('all arithmetic ops', () => {
    assert.equal(evaluate(bin('+', lit(3), lit(4))), 7);
    assert.equal(evaluate(bin('-', lit(10), lit(3))), 7);
    assert.equal(evaluate(bin('*', lit(6), lit(7))), 42);
    assert.equal(evaluate(bin('/', lit(20), lit(4))), 5);
    assert.equal(evaluate(bin('%', lit(10), lit(3))), 1);
  });

  it('comparison ops', () => {
    assert.equal(evaluate(bin('<', lit(1), lit(2))), true);
    assert.equal(evaluate(bin('<', lit(2), lit(1))), false);
    assert.equal(evaluate(bin('>', lit(5), lit(3))), true);
    assert.equal(evaluate(bin('==', lit(1), lit(1))), true);
    assert.equal(evaluate(bin('==', lit(1), lit(2))), false);
  });

  it('if-then-else true branch', () => {
    const e = ifExpr(lit(true), lit(1), lit(2));
    assert.equal(evaluate(e), 1);
  });

  it('if-then-else false branch', () => {
    const e = ifExpr(lit(false), lit(1), lit(2));
    assert.equal(evaluate(e), 2);
  });

  it('nested if', () => {
    const e = ifExpr(lit(true), ifExpr(lit(false), lit(1), lit(2)), lit(3));
    assert.equal(evaluate(e), 2);
  });

  it('let binding simple', () => {
    assert.equal(evaluate(letExpr('x', lit(42), vr('x'))), 42);
  });

  it('let binding with computation', () => {
    const e = letExpr('x', bin('+', lit(10), lit(20)), bin('*', vr('x'), lit(2)));
    assert.equal(evaluate(e), 60);
  });

  it('nested let', () => {
    const e = letExpr('x', lit(1), letExpr('y', lit(2), bin('+', vr('x'), vr('y'))));
    assert.equal(evaluate(e), 3);
  });

  it('function with arithmetic', () => {
    const add1 = lam('x', bin('+', vr('x'), lit(1)));
    assert.equal(evaluate(app(add1, lit(41))), 42);
  });

  it('function with multiple operations', () => {
    // double = \x -> x + x
    const double = lam('x', bin('+', vr('x'), vr('x')));
    assert.equal(evaluate(app(double, lit(21))), 42);
  });

  it('let + function', () => {
    const e = letExpr('f', lam('x', bin('*', vr('x'), lit(3))),
      app(vr('f'), lit(10)));
    assert.equal(evaluate(e), 30);
  });

  it('deeply nested expressions', () => {
    // (1 + (2 + (3 + (4 + 5))))
    const e = bin('+', lit(1), bin('+', lit(2), bin('+', lit(3), bin('+', lit(4), lit(5)))));
    assert.equal(evaluate(e), 15);
  });
});
