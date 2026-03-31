const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GCounter, PNCounter, GSet, ORSet, LWWRegister, LWWMap } = require('../src/index.js');

test('GCounter — increment and merge', () => {
  const a = new GCounter('A');
  const b = new GCounter('B');
  a.increment(3);
  b.increment(5);
  const merged = a.merge(b);
  assert.equal(merged.value(), 8);
});

test('GCounter — idempotent merge', () => {
  const a = new GCounter('A');
  a.increment(5);
  const merged = a.merge(a);
  assert.equal(merged.value(), 5);
});

test('PNCounter', () => {
  const a = new PNCounter('A');
  a.increment(10);
  a.decrement(3);
  assert.equal(a.value(), 7);
});

test('PNCounter — merge', () => {
  const a = new PNCounter('A');
  const b = new PNCounter('B');
  a.increment(5);
  b.decrement(2);
  const merged = a.merge(b);
  assert.equal(merged.value(), 3);
});

test('GSet — add and merge', () => {
  const a = new GSet();
  const b = new GSet();
  a.add('x').add('y');
  b.add('y').add('z');
  const merged = a.merge(b);
  assert.ok(merged.has('x'));
  assert.ok(merged.has('y'));
  assert.ok(merged.has('z'));
});

test('ORSet — add/remove', () => {
  const s = new ORSet('A');
  s.add('x').add('y');
  assert.ok(s.has('x'));
  s.remove('x');
  assert.ok(!s.has('x'));
  assert.ok(s.has('y'));
});

test('ORSet — add-wins on merge', () => {
  const a = new ORSet('A');
  const b = new ORSet('B');
  a.add('x');
  b.add('x');
  a.remove('x');
  // b still has x, so merge should have x (add-wins)
  const merged = a.merge(b);
  assert.ok(merged.has('x'));
});

test('LWWRegister', () => {
  const reg = new LWWRegister();
  reg.set('hello', 1);
  reg.set('world', 2);
  assert.equal(reg.value(), 'world');
  reg.set('old', 0); // older timestamp, ignored
  assert.equal(reg.value(), 'world');
});

test('LWWRegister — merge', () => {
  const a = new LWWRegister('a', 1);
  const b = new LWWRegister('b', 2);
  const merged = a.merge(b);
  assert.equal(merged.value(), 'b');
});

test('LWWMap — set/get/delete', () => {
  const m = new LWWMap();
  m.set('key', 'value', 1);
  assert.equal(m.get('key'), 'value');
  m.delete('key', 2);
  assert.equal(m.get('key'), undefined);
});

test('LWWMap — merge', () => {
  const a = new LWWMap();
  const b = new LWWMap();
  a.set('x', 1, 1);
  b.set('y', 2, 2);
  const merged = a.merge(b);
  assert.equal(merged.get('x'), 1);
  assert.equal(merged.get('y'), 2);
});
