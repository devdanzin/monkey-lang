import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AVLTree } from '../src/index.js';

describe('Basic operations', () => {
  it('insert and search', () => {
    const tree = new AVLTree();
    tree.insert(5).insert(3).insert(7);
    assert.equal(tree.search(3), 3);
    assert.equal(tree.search(5), 5);
    assert.equal(tree.search(10), undefined);
  });

  it('has', () => {
    const tree = new AVLTree();
    tree.insert(5);
    assert.equal(tree.has(5), true);
    assert.equal(tree.has(3), false);
  });

  it('size', () => {
    const tree = new AVLTree();
    assert.equal(tree.size, 0);
    tree.insert(5).insert(3).insert(7);
    assert.equal(tree.size, 3);
  });

  it('isEmpty', () => {
    const tree = new AVLTree();
    assert.equal(tree.isEmpty, true);
    tree.insert(1);
    assert.equal(tree.isEmpty, false);
  });

  it('min and max', () => {
    const tree = new AVLTree();
    tree.insert(5).insert(3).insert(7).insert(1).insert(9);
    assert.equal(tree.min().key, 1);
    assert.equal(tree.max().key, 9);
  });

  it('update on duplicate key', () => {
    const tree = new AVLTree();
    tree.insert(5, 'old');
    tree.insert(5, 'new');
    assert.equal(tree.search(5), 'new');
    assert.equal(tree.size, 1);
  });
});

describe('Deletion', () => {
  it('delete leaf', () => {
    const tree = new AVLTree();
    tree.insert(5).insert(3).insert(7);
    assert.equal(tree.delete(3), true);
    assert.equal(tree.has(3), false);
    assert.equal(tree.size, 2);
  });

  it('delete node with one child', () => {
    const tree = new AVLTree();
    tree.insert(5).insert(3).insert(7).insert(6);
    tree.delete(7);
    assert.equal(tree.has(7), false);
    assert.equal(tree.has(6), true);
  });

  it('delete node with two children', () => {
    const tree = new AVLTree();
    tree.insert(5).insert(3).insert(7).insert(6).insert(8);
    tree.delete(7);
    assert.equal(tree.has(7), false);
    assert.deepEqual(tree.keys(), [3, 5, 6, 8]);
  });

  it('delete non-existent returns false', () => {
    const tree = new AVLTree();
    tree.insert(5);
    assert.equal(tree.delete(99), false);
  });

  it('delete root', () => {
    const tree = new AVLTree();
    tree.insert(5);
    tree.delete(5);
    assert.equal(tree.size, 0);
    assert.equal(tree.isEmpty, true);
  });
});

describe('Balancing', () => {
  it('stays balanced after sequential inserts', () => {
    const tree = new AVLTree();
    for (let i = 1; i <= 100; i++) tree.insert(i);
    assert.equal(tree.isBalanced(), true);
    assert.equal(tree.size, 100);
    // Height should be ~log2(100) ≈ 7
    assert.ok(tree.height() <= 10);
  });

  it('stays balanced after random inserts', () => {
    const tree = new AVLTree();
    const nums = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 10000));
    for (const n of nums) tree.insert(n);
    assert.equal(tree.isBalanced(), true);
  });

  it('stays balanced after deletions', () => {
    const tree = new AVLTree();
    for (let i = 1; i <= 50; i++) tree.insert(i);
    for (let i = 1; i <= 25; i++) tree.delete(i * 2);
    assert.equal(tree.isBalanced(), true);
  });
});

describe('Traversals', () => {
  it('inOrder (sorted)', () => {
    const tree = new AVLTree();
    [5, 3, 7, 1, 4].forEach(n => tree.insert(n));
    assert.deepEqual(tree.keys(), [1, 3, 4, 5, 7]);
  });

  it('preOrder', () => {
    const tree = new AVLTree();
    tree.insert(2).insert(1).insert(3);
    const pre = tree.preOrder().map(n => n.key);
    assert.equal(pre[0], 2); // Root first
  });

  it('levelOrder', () => {
    const tree = new AVLTree();
    tree.insert(2).insert(1).insert(3);
    const levels = tree.levelOrder().map(n => n.key);
    assert.equal(levels[0], 2); // Root
  });
});

describe('Range queries', () => {
  it('range', () => {
    const tree = new AVLTree();
    [1, 3, 5, 7, 9, 11].forEach(n => tree.insert(n));
    const result = tree.range(3, 9).map(n => n.key);
    assert.deepEqual(result, [3, 5, 7, 9]);
  });

  it('floor', () => {
    const tree = new AVLTree();
    [1, 3, 5, 7].forEach(n => tree.insert(n));
    assert.equal(tree.floor(4).key, 3);
    assert.equal(tree.floor(5).key, 5);
  });

  it('ceil', () => {
    const tree = new AVLTree();
    [1, 3, 5, 7].forEach(n => tree.insert(n));
    assert.equal(tree.ceil(4).key, 5);
    assert.equal(tree.ceil(5).key, 5);
  });

  it('kthSmallest', () => {
    const tree = new AVLTree();
    [5, 3, 7, 1, 9].forEach(n => tree.insert(n));
    assert.equal(tree.kthSmallest(1).key, 1);
    assert.equal(tree.kthSmallest(3).key, 5);
    assert.equal(tree.kthSmallest(5).key, 9);
  });
});

describe('Custom comparator', () => {
  it('string keys', () => {
    const tree = new AVLTree((a, b) => a.localeCompare(b));
    tree.insert('banana').insert('apple').insert('cherry');
    assert.deepEqual(tree.keys(), ['apple', 'banana', 'cherry']);
  });
});

describe('Performance', () => {
  it('10000 inserts + lookups', () => {
    const tree = new AVLTree();
    for (let i = 0; i < 10000; i++) tree.insert(i);
    assert.equal(tree.size, 10000);
    assert.equal(tree.search(5000), 5000);
    assert.equal(tree.isBalanced(), true);
    assert.ok(tree.height() <= 20); // log2(10000) ≈ 14
  });
});
