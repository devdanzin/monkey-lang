import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { get, set, has, del, flatten, unflatten } from '../src/index.js';
const obj = { a: { b: { c: 42 } }, arr: [1, 2, 3] };
describe('get', () => {
  it('nested', () => assert.equal(get(obj, 'a.b.c'), 42));
  it('array', () => assert.equal(get(obj, 'arr[1]'), 2));
  it('default', () => assert.equal(get(obj, 'x.y', 99), 99));
  it('missing', () => assert.equal(get(obj, 'a.b.d'), undefined));
});
describe('set', () => {
  it('creates path', () => { const o = {}; set(o, 'a.b.c', 1); assert.equal(o.a.b.c, 1); });
  it('array index', () => { const o = {}; set(o, 'a[0]', 'x'); assert.equal(o.a[0], 'x'); });
});
describe('has', () => { it('yes', () => assert.ok(has(obj, 'a.b.c'))); it('no', () => assert.ok(!has(obj, 'a.b.d'))); });
describe('del', () => { it('deletes', () => { const o = { a: { b: 1 } }; del(o, 'a.b'); assert.ok(!('b' in o.a)); }); });
describe('flatten', () => { it('flattens', () => assert.deepEqual(flatten({ a: { b: 1 } }), { 'a.b': 1 })); });
describe('unflatten', () => { it('unflattens', () => { const r = unflatten({ 'a.b': 1 }); assert.equal(r.a.b, 1); }); });
