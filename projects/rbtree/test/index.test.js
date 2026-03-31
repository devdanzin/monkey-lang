const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RBTree } = require('../src/index.js');

test('insert and get', () => {
  const tree = new RBTree();
  tree.insert(5, 'five');
  tree.insert(3, 'three');
  tree.insert(7, 'seven');
  assert.equal(tree.get(5), 'five');
  assert.equal(tree.get(3), 'three');
  assert.equal(tree.get(99), undefined);
});

test('sorted order', () => {
  const tree = new RBTree();
  [5, 3, 7, 1, 4, 6, 8, 2].forEach(k => tree.insert(k));
  assert.deepEqual(tree.keys(), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('min/max', () => {
  const tree = new RBTree();
  [10, 5, 15, 3, 7].forEach(k => tree.insert(k));
  assert.equal(tree.min(), 3);
  assert.equal(tree.max(), 15);
});

test('floor/ceil', () => {
  const tree = new RBTree();
  [10, 20, 30, 40, 50].forEach(k => tree.insert(k));
  assert.equal(tree.floor(25), 20);
  assert.equal(tree.ceil(25), 30);
  assert.equal(tree.floor(10), 10);
});

test('range', () => {
  const tree = new RBTree();
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(k => tree.insert(k));
  assert.deepEqual(tree.range(3, 7), [3, 4, 5, 6, 7]);
});

test('balanced after inserts', () => {
  const tree = new RBTree();
  for (let i = 1; i <= 100; i++) tree.insert(i);
  assert.equal(tree.size, 100);
  assert.ok(tree.height() <= 14, `Height ${tree.height()} too large`); // 2 * log2(100) ≈ 13.3
  assert.ok(tree._isBalanced(), 'Tree should be black-height balanced');
});

test('update value', () => {
  const tree = new RBTree();
  tree.insert(1, 'a');
  tree.insert(1, 'b');
  assert.equal(tree.get(1), 'b');
  assert.equal(tree.size, 1);
});

test('large sequential insert', () => {
  const tree = new RBTree();
  for (let i = 0; i < 1000; i++) tree.insert(i);
  assert.equal(tree.size, 1000);
  assert.ok(tree._isBalanced());
  assert.ok(tree.height() <= 22); // 2 * log2(1000) ≈ 20
});
