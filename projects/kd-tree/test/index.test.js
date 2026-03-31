const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KDTree } = require('../src/index.js');

test('nearest neighbor — 2D', () => {
  const tree = new KDTree([[2, 3], [5, 4], [9, 6], [4, 7], [8, 1], [7, 2]]);
  const nearest = tree.nearest([9, 5]);
  assert.deepEqual(nearest, [9, 6]);
});

test('nearest neighbor — exact match', () => {
  const tree = new KDTree([[1, 1], [2, 2], [3, 3]]);
  assert.deepEqual(tree.nearest([2, 2]), [2, 2]);
});

test('k-nearest', () => {
  const tree = new KDTree([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  const result = tree.kNearest([3, 3], 3);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], [3, 3]); // closest
});

test('range search', () => {
  const tree = new KDTree([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  const results = tree.rangeSearch([2, 2], [4, 4]);
  assert.equal(results.length, 3);
});

test('radius search', () => {
  const tree = new KDTree([[0, 0], [1, 0], [0, 1], [3, 3], [5, 5]]);
  const results = tree.radiusSearch([0, 0], 1.5);
  assert.equal(results.length, 3); // [0,0], [1,0], [0,1]
});

test('3D tree', () => {
  const tree = new KDTree([[1, 1, 1], [2, 2, 2], [3, 3, 3]], 3);
  assert.deepEqual(tree.nearest([2.1, 2.1, 2.1]), [2, 2, 2]);
});

test('empty tree', () => {
  const tree = new KDTree([]);
  assert.equal(tree.nearest([1, 1]), null);
  assert.deepEqual(tree.kNearest([1, 1], 3), []);
});

test('single point', () => {
  const tree = new KDTree([[5, 5]]);
  assert.deepEqual(tree.nearest([0, 0]), [5, 5]);
});

test('large dataset', () => {
  const points = [];
  for (let i = 0; i < 1000; i++) {
    points.push([Math.random() * 100, Math.random() * 100]);
  }
  const tree = new KDTree(points);
  const nearest = tree.nearest([50, 50]);
  assert.ok(nearest);
  assert.equal(nearest.length, 2);
});
