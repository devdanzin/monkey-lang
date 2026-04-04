import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SkipList } from '../src/index.js';

describe('SkipList — basic', () => {
  it('creates empty', () => {
    const sl = new SkipList();
    assert.equal(sl.size, 0);
  });

  it('insert and search', () => {
    const sl = new SkipList();
    sl.insert(5, 'five');
    assert.equal(sl.search(5), 'five');
  });

  it('has()', () => {
    const sl = new SkipList();
    sl.insert(10);
    assert.equal(sl.has(10), true);
    assert.equal(sl.has(20), false);
  });

  it('returns undefined for missing', () => {
    const sl = new SkipList();
    assert.equal(sl.search(42), undefined);
  });

  it('updates existing key', () => {
    const sl = new SkipList();
    sl.insert(5, 'old');
    sl.insert(5, 'new');
    assert.equal(sl.search(5), 'new');
    assert.equal(sl.size, 1);
  });

  it('multiple inserts', () => {
    const sl = new SkipList();
    [5, 3, 7, 1, 9, 4, 6, 8, 2].forEach(k => sl.insert(k));
    assert.equal(sl.size, 9);
    for (const k of [1,2,3,4,5,6,7,8,9]) assert.equal(sl.has(k), true);
  });
});

describe('SkipList — delete', () => {
  it('deletes existing', () => {
    const sl = new SkipList();
    sl.insert(5);
    assert.equal(sl.delete(5), true);
    assert.equal(sl.has(5), false);
    assert.equal(sl.size, 0);
  });

  it('returns false for missing', () => {
    const sl = new SkipList();
    assert.equal(sl.delete(99), false);
  });

  it('delete middle element', () => {
    const sl = new SkipList();
    [1,2,3,4,5].forEach(k => sl.insert(k));
    sl.delete(3);
    assert.deepEqual(sl.toArray(), [1,2,4,5]);
  });
});

describe('SkipList — ordering', () => {
  it('toArray returns sorted', () => {
    const sl = new SkipList();
    [5, 3, 7, 1, 9].forEach(k => sl.insert(k));
    assert.deepEqual(sl.toArray(), [1, 3, 5, 7, 9]);
  });

  it('min/max', () => {
    const sl = new SkipList();
    [5, 3, 7, 1, 9].forEach(k => sl.insert(k));
    assert.equal(sl.min(), 1);
    assert.equal(sl.max(), 9);
  });

  it('min/max on empty', () => {
    const sl = new SkipList();
    assert.equal(sl.min(), undefined);
    assert.equal(sl.max(), undefined);
  });
});

describe('SkipList — range query', () => {
  it('returns keys in range', () => {
    const sl = new SkipList();
    [1,2,3,4,5,6,7,8,9,10].forEach(k => sl.insert(k));
    assert.deepEqual(sl.range(3, 7), [3,4,5,6,7]);
  });

  it('empty range', () => {
    const sl = new SkipList();
    [1, 10, 20].forEach(k => sl.insert(k));
    assert.deepEqual(sl.range(5, 8), []);
  });
});

describe('SkipList — entries & iterator', () => {
  it('entries returns [key, value] pairs', () => {
    const sl = new SkipList();
    sl.insert(1, 'a'); sl.insert(2, 'b');
    assert.deepEqual(sl.entries(), [[1, 'a'], [2, 'b']]);
  });

  it('iterator', () => {
    const sl = new SkipList();
    sl.insert(3); sl.insert(1); sl.insert(2);
    const items = [...sl];
    assert.deepEqual(items, [[1, 1], [2, 2], [3, 3]]);
  });
});

describe('SkipList — custom comparator', () => {
  it('string keys', () => {
    const sl = new SkipList(16, 0.5, (a, b) => a.localeCompare(b));
    sl.insert('banana'); sl.insert('apple'); sl.insert('cherry');
    assert.deepEqual(sl.toArray(), ['apple', 'banana', 'cherry']);
  });
});

describe('SkipList — stress', () => {
  it('handles 1000 inserts and deletes', () => {
    const sl = new SkipList();
    for (let i = 0; i < 1000; i++) sl.insert(i);
    assert.equal(sl.size, 1000);
    assert.deepEqual(sl.range(0, 4), [0, 1, 2, 3, 4]);
    
    for (let i = 0; i < 500; i++) sl.delete(i);
    assert.equal(sl.size, 500);
    assert.equal(sl.min(), 500);
  });
});
