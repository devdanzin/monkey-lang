import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { astar, gridSearch } from '../src/index.js';

describe('astar generic', () => {
  it('finds path in number line', () => {
    const r = astar({
      start: 0,
      goal: n => n === 5,
      neighbors: n => [n - 1, n + 1].filter(x => x >= 0 && x <= 10),
      heuristic: n => Math.abs(n - 5),
    });
    assert.deepEqual(r.path, [0, 1, 2, 3, 4, 5]);
    assert.equal(r.cost, 5);
  });

  it('returns null for impossible', () => {
    const r = astar({
      start: 0,
      goal: n => n === 100,
      neighbors: n => n < 5 ? [n + 1] : [],
      heuristic: n => Math.abs(n - 100),
    });
    assert.equal(r.path, null);
  });
});

describe('gridSearch', () => {
  it('finds path in open grid', () => {
    const grid = [[0,0,0],[0,0,0],[0,0,0]];
    const r = gridSearch(grid, [0, 0], [2, 2]);
    assert.ok(r.path);
    assert.equal(r.path[0][0], 0);
    assert.equal(r.path[r.path.length - 1][0], 2);
    assert.equal(r.cost, 4); // Manhattan distance
  });

  it('navigates around walls', () => {
    const grid = [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ];
    const r = gridSearch(grid, [0, 0], [2, 3]);
    assert.ok(r.path);
    assert.ok(r.cost >= 5); // Must go around
  });

  it('no path through wall', () => {
    const grid = [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ];
    const r = gridSearch(grid, [0, 0], [0, 2]);
    assert.equal(r.path, null);
  });
});
