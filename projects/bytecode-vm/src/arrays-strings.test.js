// arrays-strings.test.js — Array and string operations in the VM
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Op, Chunk, VM, evaluate } from './index.js';

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
const push = (arrExpr, value) => ({ tag: 'push', arr: arrExpr, value });
const concat = (left, right) => ({ tag: 'concat', left, right });
const slice = (obj, start, end) => ({ tag: 'slice', obj, start, end });

describe('Arrays and Strings', () => {
  it('empty array', () => {
    const r = evaluate(arr());
    assert.ok(Array.isArray(r));
    assert.equal(r.length, 0);
  });

  it('array with literals', () => {
    const r = evaluate(arr(lit(1), lit(2), lit(3)));
    assert.deepEqual(r, [1, 2, 3]);
  });

  it('array indexing', () => {
    const r = evaluate(idx(arr(lit(10), lit(20), lit(30)), lit(1)));
    assert.equal(r, 20);
  });

  it('array length', () => {
    const r = evaluate(len(arr(lit(1), lit(2), lit(3), lit(4))));
    assert.equal(r, 4);
  });

  it('array push', () => {
    const r = evaluate(push(arr(lit(1), lit(2)), lit(3)));
    assert.deepEqual(r, [1, 2, 3]);
  });

  it('nested array', () => {
    const r = evaluate(arr(arr(lit(1), lit(2)), arr(lit(3), lit(4))));
    assert.deepEqual(r, [[1, 2], [3, 4]]);
  });

  it('string concatenation', () => {
    const r = evaluate(concat(lit('hello'), lit(' world')));
    assert.equal(r, 'hello world');
  });

  it('string length', () => {
    const r = evaluate(len(lit('hello')));
    assert.equal(r, 5);
  });

  it('empty string length', () => {
    const r = evaluate(len(lit('')));
    assert.equal(r, 0);
  });

  it('string indexing', () => {
    const r = evaluate(idx(lit('hello'), lit(0)));
    assert.equal(r, 'h');
  });

  it('string slice', () => {
    const r = evaluate(slice(lit('hello world'), lit(0), lit(5)));
    assert.equal(r, 'hello');
  });

  it('array in let binding', () => {
    const e = letExpr('xs', arr(lit(10), lit(20), lit(30)),
      idx(vr('xs'), lit(2)));
    assert.equal(evaluate(e), 30);
  });

  it('array length in let', () => {
    const e = letExpr('xs', arr(lit(1), lit(2), lit(3)),
      len(vr('xs')));
    assert.equal(evaluate(e), 3);
  });

  it('push then index', () => {
    const e = letExpr('xs', push(arr(lit(1)), lit(2)),
      idx(vr('xs'), lit(1)));
    assert.equal(evaluate(e), 2);
  });

  it('concat multiple strings', () => {
    const e = concat(concat(lit('a'), lit('b')), lit('c'));
    assert.equal(evaluate(e), 'abc');
  });

  it('array with expressions', () => {
    const r = evaluate(arr(bin('+', lit(1), lit(2)), bin('*', lit(3), lit(4))));
    assert.deepEqual(r, [3, 12]);
  });

  it('function returning array', () => {
    const e = letExpr('f', lam('x', arr(vr('x'), bin('+', vr('x'), lit(1)))),
      app(vr('f'), lit(5)));
    assert.deepEqual(evaluate(e), [5, 6]);
  });

  it('array as function argument', () => {
    const e = letExpr('first', lam('xs', idx(vr('xs'), lit(0))),
      app(vr('first'), arr(lit(42), lit(99))));
    assert.equal(evaluate(e), 42);
  });

  it('conditional with arrays', () => {
    const e = ifExpr(lit(true), arr(lit(1)), arr(lit(2)));
    assert.deepEqual(evaluate(e), [1]);
  });

  it('boolean in array', () => {
    const r = evaluate(arr(lit(true), lit(false), lit(true)));
    assert.deepEqual(r, [true, false, true]);
  });

  it('mixed types in array', () => {
    const r = evaluate(arr(lit(1), lit('hello'), lit(true)));
    assert.deepEqual(r, [1, 'hello', true]);
  });

  it('array push preserves original', () => {
    const original = arr(lit(1), lit(2));
    const pushed = push(original, lit(3));
    assert.equal(evaluate(len(original)), 2);
    assert.equal(evaluate(len(pushed)), 3);
  });

  it('string slice from middle', () => {
    const r = evaluate(slice(lit('abcdef'), lit(2), lit(4)));
    assert.equal(r, 'cd');
  });

  it('array slice', () => {
    const r = evaluate(slice(arr(lit(1), lit(2), lit(3), lit(4)), lit(1), lit(3)));
    assert.deepEqual(r, [2, 3]);
  });
});
