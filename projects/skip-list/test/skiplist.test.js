import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SkipList } from '../src/index.js';

describe('insert/get', () => {
  it('basic', () => { const sl = new SkipList(); sl.insert(3, 'c'); sl.insert(1, 'a'); sl.insert(2, 'b'); assert.equal(sl.get(2), 'b'); });
  it('update', () => { const sl = new SkipList(); sl.insert(1, 'a'); sl.insert(1, 'A'); assert.equal(sl.get(1), 'A'); assert.equal(sl.size, 1); });
  it('missing', () => assert.equal(new SkipList().get(999), undefined));
  it('has', () => { const sl = new SkipList(); sl.insert(5, 'x'); assert.equal(sl.has(5), true); assert.equal(sl.has(6), false); });
});

describe('delete', () => {
  it('removes', () => { const sl = new SkipList(); sl.insert(1, 'a'); sl.insert(2, 'b'); sl.delete(1); assert.equal(sl.get(1), undefined); assert.equal(sl.size, 1); });
  it('returns false for missing', () => assert.equal(new SkipList().delete(99), false));
});

describe('range', () => {
  it('returns range', () => {
    const sl = new SkipList();
    for (let i = 0; i < 10; i++) sl.insert(i, i * 10);
    const r = sl.range(3, 6);
    assert.equal(r.length, 4);
    assert.equal(r[0].key, 3);
    assert.equal(r[3].key, 6);
  });
});

describe('iteration', () => {
  it('sorted order', () => {
    const sl = new SkipList();
    sl.insert(5, 'e'); sl.insert(1, 'a'); sl.insert(3, 'c');
    const keys = sl.toArray().map(e => e.key);
    assert.deepEqual(keys, [1, 3, 5]);
  });
});

describe('stress', () => {
  it('100 items', () => {
    const sl = new SkipList();
    for (let i = 0; i < 100; i++) sl.insert(i, i);
    assert.equal(sl.size, 100);
    for (let i = 0; i < 100; i++) assert.equal(sl.get(i), i);
  });
});
