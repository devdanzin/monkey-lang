const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SpatialGrid } = require('../src/spatial-grid.js');
const { Boid } = require('../src/boid.js');

test('SpatialGrid: insert and find neighbors', () => {
  const grid = new SpatialGrid(100, 100, 50);
  const b1 = new Boid(10, 10);
  const b2 = new Boid(20, 20);
  const b3 = new Boid(90, 90);
  grid.insert(b1);
  grid.insert(b2);
  grid.insert(b3);
  
  const neighbors = grid.getNeighbors(b1, 30);
  assert.ok(neighbors.includes(b2));
  assert.ok(!neighbors.includes(b3));
});

test('SpatialGrid: no self in neighbors', () => {
  const grid = new SpatialGrid(100, 100, 50);
  const b1 = new Boid(10, 10);
  grid.insert(b1);
  
  const neighbors = grid.getNeighbors(b1, 100);
  assert.ok(!neighbors.includes(b1));
});

test('SpatialGrid: clear empties all cells', () => {
  const grid = new SpatialGrid(100, 100, 50);
  grid.insert(new Boid(10, 10));
  grid.clear();
  
  const neighbors = grid.getNeighbors(new Boid(10, 10), 100);
  assert.equal(neighbors.length, 0);
});

test('SpatialGrid: wrapping neighbors', () => {
  const grid = new SpatialGrid(100, 100, 50);
  const b1 = new Boid(5, 5);
  const b2 = new Boid(95, 95);
  grid.insert(b1);
  grid.insert(b2);
  
  // They're close if we consider wrapping in the grid lookup
  // (SpatialGrid wraps cell indices but distance is Euclidean)
  // For now, they won't be neighbors in Euclidean distance
  const neighbors = grid.getNeighbors(b1, 20);
  assert.equal(neighbors.length, 0); // too far in Euclidean space
});
