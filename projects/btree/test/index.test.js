const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BTree } = require('../src/index.js');

test('insert and search', () => {
  const tree = new BTree(2);
  [10, 20, 5, 6, 12, 30, 7, 17].forEach(k => tree.insert(k));
  assert.ok(tree.search(6));
  assert.ok(tree.search(17));
  assert.ok(!tree.search(99));
});

test('in-order traversal', () => {
  const tree = new BTree(2);
  [3, 1, 4, 1, 5, 9, 2, 6].forEach(k => tree.insert(k));
  const sorted = tree.inOrder();
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i] >= sorted[i - 1]);
  }
});

test('delete', () => {
  const tree = new BTree(2);
  [1, 3, 7, 10, 11, 13, 14, 15, 18, 16, 19, 24, 25, 26, 21, 4, 5, 20, 22, 2, 17, 12, 6].forEach(k => tree.insert(k));
  
  tree.delete(6);
  assert.ok(!tree.search(6));
  tree.delete(13);
  assert.ok(!tree.search(13));
  tree.delete(7);
  assert.ok(!tree.search(7));
  
  // All remaining should still be searchable
  const remaining = tree.inOrder();
  for (const k of remaining) assert.ok(tree.search(k));
});

test('range query', () => {
  const tree = new BTree(2);
  [5, 10, 15, 20, 25, 30].forEach(k => tree.insert(k));
  assert.deepEqual(tree.range(10, 25), [10, 15, 20, 25]);
});

test('size', () => {
  const tree = new BTree(2);
  assert.equal(tree.size, 0);
  [1, 2, 3, 4, 5].forEach(k => tree.insert(k));
  assert.equal(tree.size, 5);
});

test('height stays balanced', () => {
  const tree = new BTree(3);
  for (let i = 1; i <= 100; i++) tree.insert(i);
  assert.ok(tree.height <= 4); // B-tree of order 3 with 100 keys
});

test('large insert/delete', () => {
  const tree = new BTree(3);
  for (let i = 0; i < 200; i++) tree.insert(i);
  assert.equal(tree.size, 200);
  
  for (let i = 0; i < 100; i++) tree.delete(i * 2);
  assert.equal(tree.size, 100);
  
  // Odd numbers should remain
  for (let i = 0; i < 100; i++) {
    assert.ok(tree.search(i * 2 + 1));
  }
});
