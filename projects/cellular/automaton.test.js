'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ElementaryCA, GameOfLife, patterns, patternStrings } = require('./automaton.js');

// === Elementary CA ===
test('Rule 0: all cells die', () => {
  const ca = new ElementaryCA(0, 5);
  ca.step();
  assert.deepEqual(Array.from(ca.state), [0, 0, 0, 0, 0]);
});

test('Rule 255: all cells live', () => {
  const ca = new ElementaryCA(255, 5);
  ca.step();
  assert.deepEqual(Array.from(ca.state), [1, 1, 1, 1, 1]);
});

test('Rule 30 single step', () => {
  const ca = new ElementaryCA(30, 7);
  ca.step();
  // Center cell creates pattern: ...1... -> ..111..
  assert.equal(ca.state[2], 1);
  assert.equal(ca.state[3], 1);
  assert.equal(ca.state[4], 1);
});

test('Rule 110 single step', () => {
  const ca = new ElementaryCA(110, 7);
  ca.step();
  // ...1... -> ..11...
  assert.equal(ca.state[2], 1);
  assert.equal(ca.state[3], 1);
});

test('Rule 90 (Sierpinski triangle)', () => {
  const ca = new ElementaryCA(90, 11);
  ca.run(5);
  assert.equal(ca.history.length, 6); // initial + 5 steps
});

test('Rule table is correct for rule 30', () => {
  const ca = new ElementaryCA(30);
  // Rule 30 = 00011110 in binary
  // neighborhood 0 (000) -> 0
  // neighborhood 1 (001) -> 1
  // neighborhood 2 (010) -> 1
  // neighborhood 3 (011) -> 1
  // neighborhood 4 (100) -> 1
  assert.equal(ca.ruleTable[0], 0);
  assert.equal(ca.ruleTable[1], 1);
  assert.equal(ca.ruleTable[2], 1);
  assert.equal(ca.ruleTable[3], 1);
  assert.equal(ca.ruleTable[4], 1);
  assert.equal(ca.ruleTable[5], 0);
});

test('history accumulates', () => {
  const ca = new ElementaryCA(30, 11);
  ca.run(10);
  assert.equal(ca.history.length, 11);
  assert.equal(ca.generation, 10);
});

test('reset clears state', () => {
  const ca = new ElementaryCA(30, 11);
  ca.run(5);
  ca.reset();
  assert.equal(ca.generation, 0);
  assert.equal(ca.history.length, 1);
  assert.equal(ca.state[5], 1); // center
});

test('custom initial state', () => {
  const ca = new ElementaryCA(30, 5);
  ca.reset([1, 0, 1, 0, 1]);
  assert.deepEqual(Array.from(ca.state), [1, 0, 1, 0, 1]);
});

test('toCompactASCII', () => {
  const ca = new ElementaryCA(30, 5);
  const ascii = ca.toCompactASCII();
  assert.ok(ascii.includes('#'));
  assert.ok(ascii.includes('.'));
});

test('classify rules', () => {
  assert.equal(ElementaryCA.classify(0), 1);
  assert.equal(ElementaryCA.classify(30), 3);
  assert.equal(ElementaryCA.classify(110), 4);
  assert.equal(ElementaryCA.classify(90), 3);
});

// === Game of Life ===
test('empty grid stays empty', () => {
  const gol = new GameOfLife(5, 5);
  gol.step();
  assert.equal(gol.population(), 0);
});

test('block is stable (still life)', () => {
  const gol = new GameOfLife(10, 10);
  gol.place(patterns.block, 4, 4);
  const pop0 = gol.population();
  gol.step();
  assert.equal(gol.population(), pop0);
  gol.step();
  assert.equal(gol.population(), pop0);
});

test('blinker oscillates (period 2)', () => {
  const gol = new GameOfLife(10, 10);
  gol.place(patterns.blinker, 4, 5);
  const h0 = gol.hash();
  gol.step();
  const h1 = gol.hash();
  assert.notEqual(h0, h1);
  gol.step();
  const h2 = gol.hash();
  assert.equal(h0, h2); // back to original
});

test('glider moves', () => {
  const gol = new GameOfLife(20, 20);
  gol.place(patterns.glider, 2, 2);
  const b0 = gol.getBounds();
  gol.run(4); // glider moves 1 cell diagonally every 4 steps
  const b1 = gol.getBounds();
  assert.ok(b1.minX > b0.minX || b1.minY > b0.minY);
});

test('population counts', () => {
  const gol = new GameOfLife(10, 10);
  assert.equal(gol.population(), 0);
  gol.place(patterns.glider, 0, 0);
  assert.equal(gol.population(), 5);
});

test('set and get', () => {
  const gol = new GameOfLife(5, 5);
  gol.set(2, 3, 1);
  assert.equal(gol.get(2, 3), 1);
  assert.equal(gol.get(0, 0), 0);
});

test('toggle', () => {
  const gol = new GameOfLife(5, 5);
  gol.toggle(2, 2);
  assert.equal(gol.get(2, 2), 1);
  gol.toggle(2, 2);
  assert.equal(gol.get(2, 2), 0);
});

test('countNeighbors', () => {
  const gol = new GameOfLife(5, 5);
  gol.set(1, 1, 1);
  gol.set(2, 1, 1);
  gol.set(3, 1, 1);
  assert.equal(gol.countNeighbors(2, 1), 2); // left and right
  assert.equal(gol.countNeighbors(2, 0), 3); // 3 neighbors below
  assert.equal(gol.countNeighbors(2, 2), 3); // 3 neighbors above
});

test('wrapping (toroidal)', () => {
  const gol = new GameOfLife(5, 5);
  gol.set(0, 0, 1);
  assert.equal(gol.countNeighbors(4, 4), 1); // wraps around
  assert.equal(gol.countNeighbors(1, 1), 1);
});

test('placeString', () => {
  const gol = new GameOfLife(10, 10);
  gol.placeString(patternStrings.glider, 2, 2);
  assert.equal(gol.population(), 5);
  assert.equal(gol.get(3, 2), 1); // top center
});

test('clear', () => {
  const gol = new GameOfLife(10, 10);
  gol.place(patterns.glider, 0, 0);
  gol.clear();
  assert.equal(gol.population(), 0);
  assert.equal(gol.generation, 0);
});

test('toASCII', () => {
  const gol = new GameOfLife(5, 3);
  gol.set(1, 1, 1);
  gol.set(2, 1, 1);
  const ascii = gol.toASCII();
  assert.ok(ascii.includes('##'));
  assert.equal(ascii.split('\n').length, 3);
});

test('beehive is stable', () => {
  const gol = new GameOfLife(10, 10);
  gol.place(patterns.beehive, 3, 3);
  const pop0 = gol.population();
  gol.run(5);
  assert.equal(gol.population(), pop0);
});

test('loaf is stable', () => {
  const gol = new GameOfLife(10, 10);
  gol.place(patterns.loaf, 3, 3);
  const pop0 = gol.population();
  gol.run(5);
  assert.equal(gol.population(), pop0);
});

test('toad oscillates', () => {
  const gol = new GameOfLife(10, 10);
  gol.place(patterns.toad, 3, 3);
  const h0 = gol.hash();
  gol.step();
  const h1 = gol.hash();
  gol.step();
  assert.equal(gol.hash(), h0);
  assert.notEqual(h0, h1);
});

test('r-pentomino grows', () => {
  const gol = new GameOfLife(100, 100);
  gol.place(patterns.rpentomino, 50, 50);
  assert.equal(gol.population(), 5);
  gol.run(10);
  assert.ok(gol.population() > 5);
});

test('getBounds', () => {
  const gol = new GameOfLife(20, 20);
  gol.set(5, 3, 1);
  gol.set(10, 7, 1);
  const bounds = gol.getBounds();
  assert.equal(bounds.minX, 5);
  assert.equal(bounds.maxX, 10);
  assert.equal(bounds.minY, 3);
  assert.equal(bounds.maxY, 7);
});

test('hash changes on different states', () => {
  const gol = new GameOfLife(10, 10);
  const h1 = gol.hash();
  gol.set(5, 5, 1);
  const h2 = gol.hash();
  assert.notEqual(h1, h2);
});

test('patterns all defined', () => {
  for (const [name, cells] of Object.entries(patterns)) {
    assert.ok(Array.isArray(cells), `${name} should be an array`);
    assert.ok(cells.length > 0, `${name} should have cells`);
    for (const cell of cells) {
      assert.ok(Array.isArray(cell) && cell.length === 2, `${name} cells should be [x,y]`);
    }
  }
});

test('pattern strings match patterns', () => {
  const gol1 = new GameOfLife(10, 10);
  const gol2 = new GameOfLife(10, 10);
  gol1.place(patterns.glider, 0, 0);
  gol2.placeString(patternStrings.glider, 0, 0);
  assert.equal(gol1.population(), gol2.population());
});

test('diehard eventually dies', () => {
  const gol = new GameOfLife(150, 150);
  gol.place(patterns.diehard, 70, 70);
  gol.run(130); // diehard dies by generation 130
  assert.equal(gol.population(), 0);
});

test('LWSS moves', () => {
  const gol = new GameOfLife(30, 20);
  gol.place(patterns.lwss, 2, 8);
  const pop0 = gol.population();
  gol.run(4);
  assert.equal(gol.population(), pop0); // LWSS has period 4
});

test('randomize creates cells', () => {
  const gol = new GameOfLife(50, 50);
  gol.randomize(0.3);
  assert.ok(gol.population() > 0);
  assert.ok(gol.population() < 50 * 50);
});
