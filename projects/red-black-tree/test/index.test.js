import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RedBlackTree, RED, BLACK } from '../src/index.js';

describe('RBTree — basic operations', () => {
  it('creates empty tree', () => {
    const tree = new RedBlackTree();
    assert.equal(tree.size, 0);
    assert.equal(tree.verify().valid, true);
  });

  it('inserts and finds', () => {
    const tree = new RedBlackTree();
    tree.insert(10);
    assert.equal(tree.find(10), 10);
    assert.equal(tree.has(10), true);
    assert.equal(tree.has(20), false);
  });

  it('inserts multiple', () => {
    const tree = new RedBlackTree();
    [5, 3, 7, 1, 4, 6, 8].forEach(k => tree.insert(k));
    assert.equal(tree.size, 7);
    for (const k of [5, 3, 7, 1, 4, 6, 8]) assert.equal(tree.has(k), true);
  });

  it('updates on duplicate key', () => {
    const tree = new RedBlackTree();
    tree.insert(10, 'first');
    tree.insert(10, 'second');
    assert.equal(tree.find(10), 'second');
    assert.equal(tree.size, 1);
  });

  it('min and max', () => {
    const tree = new RedBlackTree();
    [5, 3, 7, 1, 9].forEach(k => tree.insert(k));
    assert.equal(tree.min(), 1);
    assert.equal(tree.max(), 9);
  });
});

describe('RBTree — RB properties maintained', () => {
  it('root is always black', () => {
    const tree = new RedBlackTree();
    tree.insert(1);
    assert.equal(tree.verify().valid, true);
  });

  it('maintains properties after sequential inserts', () => {
    const tree = new RedBlackTree();
    for (let i = 1; i <= 20; i++) {
      tree.insert(i);
      const v = tree.verify();
      assert.equal(v.valid, true, `Failed at insert ${i}: ${v.violation}`);
    }
  });

  it('maintains properties after reverse inserts', () => {
    const tree = new RedBlackTree();
    for (let i = 20; i >= 1; i--) {
      tree.insert(i);
      assert.equal(tree.verify().valid, true);
    }
  });

  it('maintains properties after random inserts', () => {
    const tree = new RedBlackTree();
    const values = [15, 6, 18, 3, 7, 17, 20, 2, 4, 13, 9];
    for (const v of values) {
      tree.insert(v);
      const result = tree.verify();
      assert.equal(result.valid, true, `Failed at ${v}: ${result.violation}`);
    }
  });

  it('maintains properties with 100 random inserts', () => {
    const tree = new RedBlackTree();
    const nums = Array.from({ length: 100 }, () => Math.floor(Math.random() * 1000));
    for (const n of nums) {
      tree.insert(n);
      assert.equal(tree.verify().valid, true);
    }
  });
});

describe('RBTree — in-order traversal', () => {
  it('returns sorted keys', () => {
    const tree = new RedBlackTree();
    [5, 3, 7, 1, 4, 6, 8].forEach(k => tree.insert(k));
    assert.deepEqual(tree.inOrder(), [1, 3, 4, 5, 6, 7, 8]);
  });

  it('iterator works', () => {
    const tree = new RedBlackTree();
    [3, 1, 2].forEach(k => tree.insert(k));
    assert.deepEqual([...tree], [1, 2, 3]);
  });
});

describe('RBTree — delete', () => {
  it('deletes leaf', () => {
    const tree = new RedBlackTree();
    [5, 3, 7].forEach(k => tree.insert(k));
    assert.equal(tree.delete(3), true);
    assert.equal(tree.has(3), false);
    assert.equal(tree.size, 2);
    assert.equal(tree.verify().valid, true);
  });

  it('deletes node with one child', () => {
    const tree = new RedBlackTree();
    [5, 3, 7, 1].forEach(k => tree.insert(k));
    tree.delete(3);
    assert.equal(tree.has(3), false);
    assert.equal(tree.has(1), true);
    assert.equal(tree.verify().valid, true);
  });

  it('deletes node with two children', () => {
    const tree = new RedBlackTree();
    [5, 3, 7, 1, 4, 6, 8].forEach(k => tree.insert(k));
    tree.delete(5);
    assert.equal(tree.has(5), false);
    assert.equal(tree.verify().valid, true);
    assert.deepEqual(tree.inOrder(), [1, 3, 4, 6, 7, 8]);
  });

  it('deletes root', () => {
    const tree = new RedBlackTree();
    tree.insert(10);
    tree.delete(10);
    assert.equal(tree.size, 0);
    assert.equal(tree.verify().valid, true);
  });

  it('returns false for missing key', () => {
    const tree = new RedBlackTree();
    tree.insert(5);
    assert.equal(tree.delete(99), false);
  });

  it('maintains RB properties through many deletes', () => {
    const tree = new RedBlackTree();
    const keys = Array.from({ length: 50 }, (_, i) => i + 1);
    for (const k of keys) tree.insert(k);
    
    // Delete in random-ish order
    const deleteOrder = [25, 12, 37, 6, 18, 31, 43, 3, 9, 15, 21, 28, 34, 40, 47, 1, 50];
    for (const k of deleteOrder) {
      tree.delete(k);
      const v = tree.verify();
      assert.equal(v.valid, true, `Failed after deleting ${k}: ${v.violation}`);
    }
  });

  it('delete all then reinsert', () => {
    const tree = new RedBlackTree();
    [1, 2, 3, 4, 5].forEach(k => tree.insert(k));
    [1, 2, 3, 4, 5].forEach(k => tree.delete(k));
    assert.equal(tree.size, 0);
    tree.insert(10);
    assert.equal(tree.find(10), 10);
    assert.equal(tree.verify().valid, true);
  });
});

describe('RBTree — range query', () => {
  it('returns keys in range', () => {
    const tree = new RedBlackTree();
    [1, 3, 5, 7, 9, 11].forEach(k => tree.insert(k));
    assert.deepEqual(tree.range(3, 9), [3, 5, 7, 9]);
  });

  it('empty range', () => {
    const tree = new RedBlackTree();
    [1, 10, 20].forEach(k => tree.insert(k));
    assert.deepEqual(tree.range(5, 8), []);
  });
});

describe('RBTree — custom comparator', () => {
  it('works with string keys', () => {
    const tree = new RedBlackTree((a, b) => a.localeCompare(b));
    tree.insert('banana'); tree.insert('apple'); tree.insert('cherry');
    assert.deepEqual(tree.inOrder(), ['apple', 'banana', 'cherry']);
  });
});
