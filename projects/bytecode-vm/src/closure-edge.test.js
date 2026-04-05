// closure-edge.test.js — Additional tests for closures, edge cases, and error paths

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Op, Chunk, VM, Compiler, evaluate } from './index.js';
import { run } from './parser.js';

const lit = (value) => ({ tag: 'lit', value });
const bin = (op, left, right) => ({ tag: 'binop', op, left, right });
const vr = (name) => ({ tag: 'var', name });
const letExpr = (name, value, body) => ({ tag: 'let', name, value, body });
const ifExpr = (cond, then, els) => ({ tag: 'if', cond, then, else: els });
const lam = (param, body) => ({ tag: 'lam', param, body });
const app = (fn, arg) => ({ tag: 'app', fn, arg });
const arr = (...elements) => ({ tag: 'arr', elements });
const idx = (obj, index) => ({ tag: 'idx', obj, index });
const len = (obj) => ({ tag: 'len', obj });

describe('Closure edge cases', () => {
  it('lambda with let binding (same scope)', () => {
    const result = evaluate(
      letExpr('x', lit(10),
        bin('+', vr('x'), lit(5))
      )
    );
    assert.equal(result, 15);
  });

  it('nested lets with shadowing', () => {
    const result = evaluate(
      letExpr('x', lit(1),
        letExpr('x', lit(2),
          vr('x')
        )
      )
    );
    assert.equal(result, 2);
  });

  it('lambda with complex body', () => {
    const result = evaluate(
      app(
        lam('x',
          ifExpr(bin('<', vr('x'), lit(5)),
            bin('*', vr('x'), lit(2)),
            bin('+', vr('x'), lit(100))
          )
        ),
        lit(3)
      )
    );
    assert.equal(result, 6); // 3 < 5, so 3*2=6
  });

  it('lambda applied to lambda result', () => {
    const result = evaluate(
      app(lam('x', bin('+', vr('x'), lit(1))),
        app(lam('y', bin('*', vr('y'), lit(2))), lit(3))
      )
    );
    assert.equal(result, 7); // (3*2) + 1 = 7
  });
});

describe('Array edge cases', () => {
  it('empty array', () => {
    assert.deepEqual(evaluate(arr()), []);
  });

  it('nested arrays', () => {
    assert.deepEqual(evaluate(arr(arr(lit(1)), arr(lit(2)))), [[1], [2]]);
  });

  it('array of arrays length', () => {
    assert.equal(evaluate(len(arr(arr(lit(1)), arr(lit(2)), arr(lit(3))))), 3);
  });

  it('index into nested array', () => {
    const result = evaluate(
      idx(idx(arr(arr(lit(10), lit(20)), arr(lit(30), lit(40))), lit(1)), lit(0))
    );
    assert.equal(result, 30);
  });

  it('string operations', () => {
    assert.equal(evaluate(len(lit('hello world'))), 11);
    assert.equal(evaluate(idx(lit('hello'), lit(0))), 'h');
    assert.equal(evaluate(idx(lit('hello'), lit(4))), 'o');
  });
});

describe('Comparison edge cases', () => {
  it('chained comparison logic', () => {
    assert.equal(evaluate(bin('&&', bin('<', lit(1), lit(2)), bin('>', lit(3), lit(0)))), true);
    assert.equal(evaluate(bin('||', lit(false), lit(true))), true);
    assert.equal(evaluate(bin('||', lit(false), lit(false))), false);
  });

  it('equality on different types', () => {
    assert.equal(evaluate(bin('==', lit(1), lit(1))), true);
    assert.equal(evaluate(bin('==', lit(1), lit(2))), false);
    assert.equal(evaluate(bin('!=', lit(1), lit(2))), true);
  });

  it('mixed boolean and integer', () => {
    assert.equal(evaluate(bin('==', lit(true), lit(true))), true);
    assert.equal(evaluate(bin('==', lit(false), lit(false))), true);
    assert.equal(evaluate(bin('==', lit(true), lit(false))), false);
  });
});

describe('run() from source — additional', () => {
  it('negative number', () => {
    assert.equal(run('-5 + 3'), -2);
  });

  it('nested parentheses', () => {
    assert.equal(run('((1 + 2) * (3 + 4))'), 21);
  });

  it('deeply nested let', () => {
    assert.equal(run('let a = 1 in let b = 2 in let c = 3 in a + b + c'), 6);
  });

  it('boolean expressions', () => {
    assert.equal(run('true'), true);
    assert.equal(run('false'), false);
  });

  it('comparison chain', () => {
    assert.equal(run('if 5 > 3 then 1 else 0'), 1);
    assert.equal(run('if 1 > 3 then 1 else 0'), 0);
  });

  it('string literal', () => {
    assert.equal(run('"hello"'), 'hello');
  });

  it('array operations', () => {
    assert.deepEqual(run('[1, 2, 3]'), [1, 2, 3]);
    assert.equal(run('[10, 20, 30][1]'), 20);
    assert.equal(run('len([1, 2, 3, 4])'), 4);
  });

  it('computed array elements', () => {
    assert.deepEqual(run('[1 + 1, 2 * 3, 4 - 1]'), [2, 6, 3]);
  });

  it('let with array', () => {
    assert.equal(run('let xs = [10, 20, 30] in xs[2]'), 30);
  });

  it('function applied to number', () => {
    assert.equal(run('let square = fn x -> x * x in square(7)'), 49);
  });

  it('function max via nested if', () => {
    assert.equal(run(`
      let a = 10 in
      let b = 20 in
      let x = if a > b then a else b in
      let c = 30 in
      let d = 5 in
      let y = if c > d then c else d in
      x + y
    `), 50);
  });

  it('comments are ignored', () => {
    assert.equal(run('42 // this is a comment'), 42);
  });
});
