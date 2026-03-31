const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ImmutableList, ImmutableMap, ImmutableSet, ImmutableStack } = require('../src/index.js');

test('ImmutableList — push returns new list', () => {
  const a = ImmutableList.of(1, 2, 3);
  const b = a.push(4);
  assert.equal(a.size, 3);
  assert.equal(b.size, 4);
  assert.equal(b.get(3), 4);
});

test('ImmutableList — set returns new list', () => {
  const a = ImmutableList.of(1, 2, 3);
  const b = a.set(1, 20);
  assert.equal(a.get(1), 2);
  assert.equal(b.get(1), 20);
});

test('ImmutableList — map/filter', () => {
  const a = ImmutableList.of(1, 2, 3, 4);
  const doubled = a.map(x => x * 2);
  const evens = a.filter(x => x % 2 === 0);
  assert.deepEqual(doubled.toArray(), [2, 4, 6, 8]);
  assert.deepEqual(evens.toArray(), [2, 4]);
});

test('ImmutableList — equals', () => {
  const a = ImmutableList.of(1, 2, 3);
  const b = ImmutableList.of(1, 2, 3);
  const c = ImmutableList.of(1, 2, 4);
  assert.ok(a.equals(b));
  assert.ok(!a.equals(c));
});

test('ImmutableList — slice/reverse/sort', () => {
  const a = ImmutableList.of(3, 1, 2);
  assert.deepEqual(a.sort().toArray(), [1, 2, 3]);
  assert.deepEqual(a.reverse().toArray(), [2, 1, 3]);
  assert.deepEqual(a.slice(1).toArray(), [1, 2]);
});

test('ImmutableMap — set/get/delete', () => {
  const m = ImmutableMap.of({ a: 1 });
  const m2 = m.set('b', 2);
  assert.equal(m.size, 1);
  assert.equal(m2.size, 2);
  assert.equal(m2.get('b'), 2);
  
  const m3 = m2.delete('a');
  assert.equal(m3.size, 1);
  assert.ok(!m3.has('a'));
});

test('ImmutableMap — merge', () => {
  const a = ImmutableMap.of({ x: 1 });
  const b = ImmutableMap.of({ y: 2 });
  const merged = a.merge(b);
  assert.equal(merged.get('x'), 1);
  assert.equal(merged.get('y'), 2);
});

test('ImmutableMap — map/filter', () => {
  const m = ImmutableMap.of({ a: 1, b: 2, c: 3 });
  const doubled = m.map(v => v * 2);
  assert.equal(doubled.get('b'), 4);
  
  const big = m.filter(v => v > 1);
  assert.equal(big.size, 2);
});

test('ImmutableSet — add/delete', () => {
  const s = ImmutableSet.of(1, 2, 3);
  const s2 = s.add(4);
  assert.equal(s.size, 3);
  assert.equal(s2.size, 4);
  
  const s3 = s2.delete(2);
  assert.ok(!s3.has(2));
});

test('ImmutableSet — union/intersect/difference', () => {
  const a = ImmutableSet.of(1, 2, 3);
  const b = ImmutableSet.of(2, 3, 4);
  
  assert.deepEqual(a.union(b).toArray().sort(), [1, 2, 3, 4]);
  assert.deepEqual(a.intersect(b).toArray().sort(), [2, 3]);
  assert.deepEqual(a.difference(b).toArray(), [1]);
});

test('ImmutableStack — push/pop', () => {
  let s = new ImmutableStack();
  s = s.push(1).push(2).push(3);
  assert.equal(s.peek(), 3);
  
  const [val, s2] = s.pop();
  assert.equal(val, 3);
  assert.equal(s2.size, 2);
  assert.equal(s.size, 3); // original unchanged
});

test('ImmutableStack — empty pop throws', () => {
  const s = new ImmutableStack();
  assert.throws(() => s.pop(), /empty/);
});

test('iteration', () => {
  const list = ImmutableList.of(1, 2, 3);
  assert.deepEqual([...list], [1, 2, 3]);
  
  const set = ImmutableSet.of(1, 2);
  assert.equal([...set].length, 2);
});
