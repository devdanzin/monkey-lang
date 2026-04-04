import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BTree } from '../src/index.js';

describe('BTree — basic operations', () => {
  it('creates empty tree', () => {
    const tree = new BTree(2);
    assert.equal(tree.size, 0);
  });

  it('inserts and retrieves a single key', () => {
    const tree = new BTree(2);
    tree.set(5, 'five');
    assert.equal(tree.get(5), 'five');
    assert.equal(tree.size, 1);
  });

  it('has() works', () => {
    const tree = new BTree(2);
    tree.set(5, 'five');
    assert.equal(tree.has(5), true);
    assert.equal(tree.has(6), false);
  });

  it('updates existing key', () => {
    const tree = new BTree(2);
    tree.set(5, 'five');
    tree.set(5, 'FIVE');
    assert.equal(tree.get(5), 'FIVE');
    assert.equal(tree.size, 1);
  });

  it('returns undefined for missing key', () => {
    const tree = new BTree(2);
    assert.equal(tree.get(99), undefined);
  });
});

describe('BTree — insert and search', () => {
  it('inserts multiple keys in order', () => {
    const tree = new BTree(2);
    for (let i = 1; i <= 10; i++) tree.set(i, `val${i}`);
    for (let i = 1; i <= 10; i++) assert.equal(tree.get(i), `val${i}`);
    assert.equal(tree.size, 10);
  });

  it('inserts keys in reverse order', () => {
    const tree = new BTree(2);
    for (let i = 10; i >= 1; i--) tree.set(i, i * 10);
    for (let i = 1; i <= 10; i++) assert.equal(tree.get(i), i * 10);
  });

  it('inserts keys in random order', () => {
    const tree = new BTree(3);
    const keys = [5, 3, 8, 1, 4, 7, 2, 9, 6, 10];
    for (const k of keys) tree.set(k, k);
    for (const k of keys) assert.equal(tree.get(k), k);
  });

  it('handles many insertions (100 keys)', () => {
    const tree = new BTree(3);
    for (let i = 0; i < 100; i++) tree.set(i, i);
    assert.equal(tree.size, 100);
    for (let i = 0; i < 100; i++) assert.equal(tree.get(i), i);
  });

  it('handles many insertions (1000 keys)', () => {
    const tree = new BTree(4);
    for (let i = 0; i < 1000; i++) tree.set(i, i * 2);
    assert.equal(tree.size, 1000);
    for (let i = 0; i < 1000; i++) assert.equal(tree.get(i), i * 2);
  });
});

describe('BTree — deletion', () => {
  it('deletes a key from leaf', () => {
    const tree = new BTree(2);
    tree.set(5, 'five');
    assert.equal(tree.delete(5), true);
    assert.equal(tree.has(5), false);
    assert.equal(tree.size, 0);
  });

  it('delete returns false for missing key', () => {
    const tree = new BTree(2);
    assert.equal(tree.delete(99), false);
  });

  it('deletes multiple keys', () => {
    const tree = new BTree(2);
    for (let i = 1; i <= 10; i++) tree.set(i, i);
    
    tree.delete(5);
    tree.delete(3);
    tree.delete(8);
    
    assert.equal(tree.size, 7);
    assert.equal(tree.has(5), false);
    assert.equal(tree.has(3), false);
    assert.equal(tree.has(8), false);
    assert.equal(tree.has(1), true);
    assert.equal(tree.has(10), true);
  });

  it('deletes all keys', () => {
    const tree = new BTree(2);
    for (let i = 1; i <= 10; i++) tree.set(i, i);
    for (let i = 1; i <= 10; i++) tree.delete(i);
    assert.equal(tree.size, 0);
  });

  it('deletes from tree with many keys', () => {
    const tree = new BTree(3);
    for (let i = 0; i < 50; i++) tree.set(i, i);
    
    // Delete every other key
    for (let i = 0; i < 50; i += 2) tree.delete(i);
    
    assert.equal(tree.size, 25);
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) assert.equal(tree.has(i), false);
      else assert.equal(tree.has(i), true);
    }
  });
});

describe('BTree — traversal', () => {
  it('iterates in sorted order', () => {
    const tree = new BTree(2);
    const keys = [5, 3, 8, 1, 4, 7, 2, 9, 6, 10];
    for (const k of keys) tree.set(k, k);
    
    const result = tree.keys();
    assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('entries() returns key-value pairs', () => {
    const tree = new BTree(2);
    tree.set(1, 'a');
    tree.set(2, 'b');
    tree.set(3, 'c');
    
    const entries = [...tree.entries()];
    assert.deepEqual(entries, [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('values() returns values in key order', () => {
    const tree = new BTree(2);
    tree.set(3, 'c');
    tree.set(1, 'a');
    tree.set(2, 'b');
    
    assert.deepEqual(tree.values(), ['a', 'b', 'c']);
  });
});

describe('BTree — range queries', () => {
  it('range query returns keys in range', () => {
    const tree = new BTree(2);
    for (let i = 1; i <= 20; i++) tree.set(i, i);
    
    const result = tree.range(5, 10);
    assert.deepEqual(result.map(([k]) => k), [5, 6, 7, 8, 9, 10]);
  });

  it('range query with no results', () => {
    const tree = new BTree(2);
    for (let i = 1; i <= 10; i++) tree.set(i, i);
    
    const result = tree.range(20, 30);
    assert.equal(result.length, 0);
  });

  it('range query single element', () => {
    const tree = new BTree(2);
    for (let i = 1; i <= 10; i++) tree.set(i, i);
    
    const result = tree.range(5, 5);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], [5, 5]);
  });
});

describe('BTree — min/max', () => {
  it('min returns smallest key', () => {
    const tree = new BTree(2);
    tree.set(5, 'e'); tree.set(3, 'c'); tree.set(8, 'h');
    assert.deepEqual(tree.min(), [3, 'c']);
  });

  it('max returns largest key', () => {
    const tree = new BTree(2);
    tree.set(5, 'e'); tree.set(3, 'c'); tree.set(8, 'h');
    assert.deepEqual(tree.max(), [8, 'h']);
  });

  it('min/max on empty tree', () => {
    const tree = new BTree(2);
    assert.equal(tree.min(), undefined);
    assert.equal(tree.max(), undefined);
  });
});

describe('BTree — properties', () => {
  it('height is logarithmic', () => {
    const tree = new BTree(3);
    for (let i = 0; i < 1000; i++) tree.set(i, i);
    // B-tree with order 3 (max 5 keys per node): height should be ~5-6 for 1000 keys
    assert.ok(tree.height <= 7, `Height ${tree.height} too large for 1000 keys`);
    assert.ok(tree.height >= 2, `Height ${tree.height} too small for 1000 keys`);
  });

  it('different orders work', () => {
    for (const order of [2, 3, 4, 5, 10]) {
      const tree = new BTree(order);
      for (let i = 0; i < 100; i++) tree.set(i, i);
      assert.equal(tree.size, 100);
      for (let i = 0; i < 100; i++) assert.equal(tree.get(i), i);
    }
  });

  it('string keys', () => {
    const tree = new BTree(3);
    tree.set('banana', 1);
    tree.set('apple', 2);
    tree.set('cherry', 3);
    
    assert.equal(tree.get('apple'), 2);
    assert.deepEqual(tree.keys(), ['apple', 'banana', 'cherry']);
  });
});
