import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deepClone, deepMerge, deepEqual, flatten, unflatten, get, set } from '../src/index.js';

describe('deepClone', () => {
  it('clones objects', () => { const o = { a: { b: 1 } }; const c = deepClone(o); c.a.b = 2; assert.equal(o.a.b, 1); });
  it('clones arrays', () => { const a = [1, [2, 3]]; const c = deepClone(a); c[1][0] = 99; assert.equal(a[1][0], 2); });
  it('clones Date', () => { const d = new Date(); const c = deepClone(d); assert.equal(c.getTime(), d.getTime()); assert.notEqual(c, d); });
  it('clones Map', () => { const m = new Map([['a', 1]]); const c = deepClone(m); c.set('a', 2); assert.equal(m.get('a'), 1); });
});
describe('deepMerge', () => {
  it('merges nested', () => { const r = deepMerge({ a: { x: 1 } }, { a: { y: 2 } }); assert.deepEqual(r, { a: { x: 1, y: 2 } }); });
  it('overwrites primitives', () => { assert.deepEqual(deepMerge({ a: 1 }, { a: 2 }), { a: 2 }); });
});
describe('deepEqual', () => {
  it('equal objects', () => assert.equal(deepEqual({ a: [1, 2] }, { a: [1, 2] }), true));
  it('not equal', () => assert.equal(deepEqual({ a: 1 }, { a: 2 }), false));
});
describe('flatten/unflatten', () => {
  it('flattens', () => assert.deepEqual(flatten({ a: { b: 1, c: 2 } }), { 'a.b': 1, 'a.c': 2 }));
  it('unflattens', () => assert.deepEqual(unflatten({ 'a.b': 1 }), { a: { b: 1 } }));
  it('roundtrips', () => { const o = { x: { y: { z: 1 } } }; assert.deepEqual(unflatten(flatten(o)), o); });
});
describe('get/set', () => {
  it('get nested', () => assert.equal(get({ a: { b: { c: 42 } } }, 'a.b.c'), 42));
  it('get with default', () => assert.equal(get({ a: 1 }, 'b.c', 99), 99));
  it('set nested', () => { const o = {}; set(o, 'a.b.c', 42); assert.equal(o.a.b.c, 42); });
});
