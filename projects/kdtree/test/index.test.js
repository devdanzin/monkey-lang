import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KDTree } from '../src/index.js';

describe('KDTree — basic', () => {
  it('creates empty', () => {
    const tree = new KDTree(2);
    assert.equal(tree.size, 0);
  });

  it('inserts points', () => {
    const tree = new KDTree(2);
    tree.insert([3, 6]); tree.insert([17, 15]); tree.insert([13, 15]);
    assert.equal(tree.size, 3);
  });

  it('builds balanced from points', () => {
    const points = [[2,3],[5,4],[9,6],[4,7],[8,1],[7,2]];
    const tree = KDTree.fromPoints(points);
    assert.equal(tree.size, 6);
  });
});

describe('KDTree — nearest neighbor', () => {
  it('finds nearest point', () => {
    const tree = KDTree.fromPoints([[2,3],[5,4],[9,6],[4,7],[8,1],[7,2]]);
    const [nearest] = tree.nearest([6, 3]);
    assert.deepEqual(nearest.point, [7, 2]);
  });

  it('exact match', () => {
    const tree = new KDTree(2);
    tree.insert([5, 5]); tree.insert([3, 3]); tree.insert([7, 7]);
    const [nearest] = tree.nearest([5, 5]);
    assert.deepEqual(nearest.point, [5, 5]);
    assert.equal(nearest.dist, 0);
  });

  it('k nearest neighbors', () => {
    const tree = KDTree.fromPoints([[1,1],[2,2],[3,3],[4,4],[5,5]]);
    const result = tree.nearest([3, 3], 3);
    assert.equal(result.length, 3);
    assert.deepEqual(result[0].point, [3, 3]); // closest
  });

  it('k > size returns all', () => {
    const tree = KDTree.fromPoints([[1,1],[2,2]]);
    const result = tree.nearest([0, 0], 10);
    assert.equal(result.length, 2);
  });
});

describe('KDTree — range search', () => {
  it('finds points within radius', () => {
    const tree = KDTree.fromPoints([[0,0],[1,0],[0,1],[3,3],[10,10]]);
    const results = tree.rangeSearch([0, 0], 1.5);
    assert.equal(results.length, 3); // (0,0), (1,0), (0,1)
  });

  it('empty result', () => {
    const tree = KDTree.fromPoints([[10,10],[20,20]]);
    assert.equal(tree.rangeSearch([0, 0], 1).length, 0);
  });
});

describe('KDTree — rectangular search', () => {
  it('finds points in rectangle', () => {
    const tree = KDTree.fromPoints([[1,1],[2,2],[3,3],[4,4],[5,5]]);
    const results = tree.rectSearch([2, 2], [4, 4]);
    assert.ok(results.length >= 3);
    assert.ok(results.some(r => r.point[0] === 2 && r.point[1] === 2));
    assert.ok(results.some(r => r.point[0] === 3 && r.point[1] === 3));
  });
});

describe('KDTree — 3D', () => {
  it('works with 3 dimensions', () => {
    const tree = new KDTree(3);
    tree.insert([1,2,3]); tree.insert([4,5,6]); tree.insert([7,8,9]);
    const [nearest] = tree.nearest([4, 5, 6]);
    assert.deepEqual(nearest.point, [4, 5, 6]);
  });
});

describe('KDTree — data', () => {
  it('stores and retrieves data', () => {
    const tree = new KDTree(2);
    tree.insert([40.7128, -74.0060], 'New York');
    tree.insert([34.0522, -118.2437], 'Los Angeles');
    tree.insert([41.8781, -87.6298], 'Chicago');
    
    const [nearest] = tree.nearest([40, -74]);
    assert.equal(nearest.data, 'New York');
  });
});
