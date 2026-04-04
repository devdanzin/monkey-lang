import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, astar, bfs, heuristics } from '../src/index.js';

describe('Grid', () => {
  it('creates grid', () => {
    const g = new Grid(10, 10);
    assert.equal(g.width, 10);
    assert.equal(g.passable(0, 0), true);
  });

  it('walls', () => {
    const g = new Grid(5, 5);
    g.setWall(2, 2);
    assert.equal(g.isWall(2, 2), true);
    assert.equal(g.passable(2, 2), false);
  });

  it('neighbors4', () => {
    const g = new Grid(3, 3);
    const n = g.neighbors4(1, 1);
    assert.equal(n.length, 4);
  });

  it('neighbors4 at corner', () => {
    const g = new Grid(3, 3);
    const n = g.neighbors4(0, 0);
    assert.equal(n.length, 2);
  });

  it('neighbors exclude walls', () => {
    const g = new Grid(3, 3);
    g.setWall(1, 0);
    const n = g.neighbors4(1, 1);
    assert.equal(n.length, 3);
  });

  it('fromString', () => {
    const { grid, start, end } = Grid.fromString(
      'S...\n' +
      '.##.\n' +
      '...E'
    );
    assert.deepEqual(start, [0, 0]);
    assert.deepEqual(end, [3, 2]);
    assert.equal(grid.isWall(1, 1), true);
    assert.equal(grid.isWall(2, 1), true);
  });
});

describe('A* — basic', () => {
  it('finds direct path', () => {
    const g = new Grid(5, 1);
    const result = astar(g, [0, 0], [4, 0]);
    assert.ok(result.path);
    assert.equal(result.path.length, 5);
    assert.deepEqual(result.path[0], [0, 0]);
    assert.deepEqual(result.path[4], [4, 0]);
  });

  it('finds path around wall', () => {
    const g = new Grid(5, 3);
    g.setWall(2, 0); g.setWall(2, 1); // wall in column 2
    const result = astar(g, [0, 0], [4, 0]);
    assert.ok(result.path);
    assert.ok(result.path.length > 5); // must go around
  });

  it('returns null for no path', () => {
    const g = new Grid(5, 3);
    // Complete wall
    for (let y = 0; y < 3; y++) g.setWall(2, y);
    const result = astar(g, [0, 0], [4, 0]);
    assert.equal(result.path, null);
  });

  it('start equals end', () => {
    const g = new Grid(3, 3);
    const result = astar(g, [1, 1], [1, 1]);
    assert.ok(result.path);
    assert.equal(result.path.length, 1);
    assert.equal(result.cost, 0);
  });
});

describe('A* — heuristics', () => {
  it('manhattan', () => {
    assert.equal(heuristics.manhattan([0, 0], [3, 4]), 7);
  });

  it('euclidean', () => {
    assert.ok(Math.abs(heuristics.euclidean([0, 0], [3, 4]) - 5) < 0.001);
  });

  it('chebyshev', () => {
    assert.equal(heuristics.chebyshev([0, 0], [3, 4]), 4);
  });

  it('zero heuristic (Dijkstra)', () => {
    const g = new Grid(5, 5);
    const result = astar(g, [0, 0], [4, 4], { heuristic: heuristics.zero });
    assert.ok(result.path);
  });
});

describe('A* — diagonal', () => {
  it('finds diagonal path', () => {
    const g = new Grid(5, 5);
    const result = astar(g, [0, 0], [4, 4], { diagonal: true });
    assert.ok(result.path);
    assert.equal(result.path.length, 5); // diagonal = 5 steps
  });
});

describe('A* — weighted', () => {
  it('prefers low-weight path', () => {
    const g = new Grid(3, 3);
    // Make direct path expensive
    g.setWeight(1, 0, 10);
    const result = astar(g, [0, 0], [2, 0]);
    // Should prefer going around (via y=1)
    assert.ok(result.path);
    assert.ok(result.cost < 15);
  });
});

describe('A* — from string', () => {
  it('solves maze', () => {
    const { grid, start, end } = Grid.fromString(
      'S....\n' +
      '###..\n' +
      '.....\n' +
      '..###\n' +
      '....E'
    );
    const result = astar(grid, start, end);
    assert.ok(result.path);
    assert.deepEqual(result.path[0], start);
    assert.deepEqual(result.path[result.path.length - 1], end);
  });
});

describe('BFS', () => {
  it('finds shortest unweighted path', () => {
    const g = new Grid(5, 1);
    const result = bfs(g, [0, 0], [4, 0]);
    assert.ok(result.path);
    assert.equal(result.cost, 4);
  });

  it('returns null for no path', () => {
    const g = new Grid(5, 3);
    for (let y = 0; y < 3; y++) g.setWall(2, y);
    const result = bfs(g, [0, 0], [4, 0]);
    assert.equal(result.path, null);
  });
});

describe('Grid — render', () => {
  it('renders with path', () => {
    const g = new Grid(3, 1);
    const rendered = g.render([[0, 0], [1, 0], [2, 0]]);
    assert.equal(rendered.trim(), '***');
  });
});
