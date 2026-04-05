import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cons, list, head, tail, isEmpty, listMap, listFilter, listReduce, listToArray, listFromArray, listReverse, EMPTY_LIST, PMap } from './immutable.js';

describe('Persistent List', () => {
  it('empty', () => { assert.ok(isEmpty(EMPTY_LIST)); assert.equal(EMPTY_LIST.size, 0); });
  it('cons', () => { const l = cons(1, cons(2, cons(3))); assert.equal(head(l), 1); assert.equal(l.size, 3); });
  it('list', () => { const l = list(1, 2, 3); assert.equal(head(l), 1); assert.equal(l.size, 3); });
  it('head/tail', () => { const l = list(1, 2); assert.equal(head(l), 1); assert.equal(head(tail(l)), 2); });
  it('toArray', () => { assert.deepStrictEqual(listToArray(list(1, 2, 3)), [1, 2, 3]); });
  it('fromArray', () => { assert.deepStrictEqual(listToArray(listFromArray([4, 5, 6])), [4, 5, 6]); });
  it('iterable', () => { assert.deepStrictEqual([...list(1, 2, 3)], [1, 2, 3]); });
  it('map', () => { assert.deepStrictEqual(listToArray(listMap(list(1, 2, 3), x => x * 2)), [2, 4, 6]); });
  it('filter', () => { assert.deepStrictEqual(listToArray(listFilter(list(1, 2, 3, 4), x => x % 2 === 0)), [2, 4]); });
  it('reduce', () => { assert.equal(listReduce(list(1, 2, 3), (a, b) => a + b, 0), 6); });
  it('reverse', () => { assert.deepStrictEqual(listToArray(listReverse(list(1, 2, 3))), [3, 2, 1]); });
  it('structural sharing', () => { const l1 = list(1, 2, 3); const l2 = cons(0, l1); assert.equal(tail(l2), l1); }); // same object
  it('immutable', () => { const l = list(1, 2, 3); assert.ok(Object.isFrozen(l)); });
});

describe('PMap', () => {
  it('empty', () => { const m = new PMap(); assert.equal(m.size, 0); });
  it('assoc/get', () => { const m = new PMap().assoc('a', 1); assert.equal(m.get('a'), 1); });
  it('has', () => { assert.ok(new PMap().assoc('a', 1).has('a')); assert.ok(!new PMap().has('a')); });
  it('dissoc', () => { const m = new PMap().assoc('a', 1).assoc('b', 2).dissoc('a'); assert.ok(!m.has('a')); assert.ok(m.has('b')); });
  it('update', () => { const m = new PMap().assoc('count', 0).update('count', n => n + 1); assert.equal(m.get('count'), 1); });
  it('merge', () => { const a = PMap.fromObject({ x: 1 }); const b = PMap.fromObject({ y: 2 }); const c = a.merge(b); assert.equal(c.get('x'), 1); assert.equal(c.get('y'), 2); });
  it('map', () => { const m = PMap.fromObject({ a: 1, b: 2 }).map(v => v * 10); assert.equal(m.get('a'), 10); });
  it('filter', () => { const m = PMap.fromObject({ a: 1, b: 2, c: 3 }).filter(v => v > 1); assert.equal(m.size, 2); });
  it('toObject/fromObject', () => { const obj = { x: 1, y: 2 }; assert.deepStrictEqual(PMap.fromObject(obj).toObject(), obj); });
  it('equals', () => { assert.ok(PMap.fromObject({ a: 1 }).equals(PMap.fromObject({ a: 1 }))); });
  it('not equals', () => { assert.ok(!PMap.fromObject({ a: 1 }).equals(PMap.fromObject({ a: 2 }))); });
  it('immutable (frozen)', () => { assert.ok(Object.isFrozen(new PMap())); });
  it('original unchanged', () => {
    const m1 = PMap.fromObject({ a: 1 });
    const m2 = m1.assoc('b', 2);
    assert.ok(!m1.has('b'));
    assert.ok(m2.has('b'));
  });
  it('default value', () => { assert.equal(new PMap().get('x', 42), 42); });
  it('keys/values/entries', () => {
    const m = PMap.fromObject({ a: 1, b: 2 });
    assert.deepStrictEqual(m.keys().sort(), ['a', 'b']);
    assert.deepStrictEqual(m.values().sort(), [1, 2]);
  });
});
