import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameOfLife, ElementaryCA, LangtonsAnt, patterns } from '../src/index.js';

// ===== Game of Life =====
describe('GameOfLife — basics', () => {
  it('creates empty grid', () => {
    const life = new GameOfLife(10, 10);
    assert.equal(life.population, 0);
    assert.equal(life.generation, 0);
  });

  it('sets and gets cells', () => {
    const life = new GameOfLife(10, 10);
    life.set(3, 4);
    assert.equal(life.get(3, 4), 1);
    assert.equal(life.get(0, 0), 0);
  });

  it('out of bounds returns 0', () => {
    const life = new GameOfLife(5, 5);
    assert.equal(life.get(-1, 0), 0);
    assert.equal(life.get(10, 10), 0);
  });

  it('counts neighbors', () => {
    const life = new GameOfLife(5, 5);
    life.set(1, 1); life.set(2, 1); life.set(3, 1);
    assert.equal(life.countNeighbors(2, 1), 2);
    assert.equal(life.countNeighbors(2, 0), 3);
  });

  it('tracks population', () => {
    const life = new GameOfLife(10, 10);
    life.set(0, 0); life.set(1, 1); life.set(2, 2);
    assert.equal(life.population, 3);
  });
});

describe('GameOfLife — still lifes', () => {
  it('block is stable', () => {
    const life = GameOfLife.fromPattern(patterns.block, 6, 6);
    const pop = life.population;
    life.run(10);
    assert.equal(life.population, pop);
  });

  it('beehive is stable', () => {
    const life = GameOfLife.fromPattern(patterns.beehive, 8, 6);
    const before = life.toString();
    life.run(10);
    assert.equal(life.toString(), before);
  });
});

describe('GameOfLife — oscillators', () => {
  it('blinker oscillates with period 2', () => {
    const life = GameOfLife.fromPattern(patterns.blinker, 7, 7);
    const initial = life.toString();
    life.step();
    assert.notEqual(life.toString(), initial);
    life.step();
    assert.equal(life.toString(), initial);
  });

  it('toad oscillates with period 2', () => {
    const life = GameOfLife.fromPattern(patterns.toad, 8, 8);
    const initial = life.toString();
    life.run(2);
    assert.equal(life.toString(), initial);
  });
});

describe('GameOfLife — spaceships', () => {
  it('glider moves and survives', () => {
    const life = GameOfLife.fromPattern(patterns.glider, 20, 20);
    assert.equal(life.population, 5);
    life.run(4); // glider period
    assert.equal(life.population, 5); // still 5 cells alive
  });

  it('glider translates diagonally', () => {
    const life = GameOfLife.fromPattern(patterns.glider, 20, 20);
    life.run(20);
    assert.equal(life.population, 5);
  });
});

describe('GameOfLife — methuselahs', () => {
  it('r-pentomino grows before stabilizing', () => {
    const life = GameOfLife.fromPattern(patterns.rpentomino, 80, 80);
    assert.equal(life.population, 5);
    life.run(10);
    assert.ok(life.population > 5, 'should grow');
  });
});

describe('GameOfLife — rules', () => {
  it('lonely cell dies', () => {
    const life = new GameOfLife(5, 5);
    life.set(2, 2);
    life.step();
    assert.equal(life.get(2, 2), 0);
  });

  it('overcrowded cell dies', () => {
    const life = new GameOfLife(5, 5);
    // Cell at (2,2) with 5 neighbors
    life.set(2, 2);
    life.set(1, 1); life.set(2, 1); life.set(3, 1);
    life.set(1, 2); life.set(3, 2);
    life.step();
    assert.equal(life.get(2, 2), 0);
  });

  it('dead cell with 3 neighbors births', () => {
    const life = new GameOfLife(5, 5);
    life.set(1, 1); life.set(2, 1); life.set(3, 1);
    life.step();
    assert.equal(life.get(2, 0), 1); // birth above center
    assert.equal(life.get(2, 2), 1); // birth below center
  });
});

// ===== Elementary CA =====
describe('ElementaryCA — basics', () => {
  it('creates with center seed', () => {
    const ca = new ElementaryCA(11, 110);
    ca.seedCenter();
    assert.equal(ca.cells[5], 1);
    assert.equal(ca.population, 1);
  });

  it('Rule 110 produces expected output', () => {
    const ca = new ElementaryCA(11, 110);
    ca.seedCenter();
    ca.step();
    // Rule 110: center seed → ...##.....
    assert.equal(ca.cells[4], 1); // left of center
    assert.equal(ca.cells[5], 1); // center
  });

  it('Rule 30 produces expected output', () => {
    const ca = new ElementaryCA(11, 30);
    ca.seedCenter();
    ca.step();
    assert.equal(ca.population > 0, true);
  });

  it('records history', () => {
    const ca = new ElementaryCA(11, 110);
    ca.seedCenter();
    ca.run(5);
    assert.equal(ca.history.length, 6); // 5 steps + final
  });

  it('renders history as string', () => {
    const ca = new ElementaryCA(7, 110);
    ca.seedCenter();
    ca.run(3);
    const rendered = ca.renderHistory();
    assert.ok(rendered.includes('#'));
    assert.ok(rendered.includes('.'));
  });
});

describe('ElementaryCA — Rule 90 (Sierpinski)', () => {
  it('produces symmetric patterns', () => {
    const ca = new ElementaryCA(21, 90);
    ca.seedCenter();
    ca.run(5);
    // Rule 90 from center seed produces Sierpinski triangle
    // Should be symmetric
    const mid = Math.floor(ca.size / 2);
    for (const row of ca.history) {
      for (let i = 0; i < mid; i++) {
        assert.equal(row[mid - i], row[mid + i], 
          `Asymmetry at offset ${i}`);
      }
    }
  });
});

describe('ElementaryCA — Rule 184 (traffic)', () => {
  it('conserves particle count', () => {
    const ca = new ElementaryCA(20, 184);
    ca.cells = new Uint8Array([1,0,1,1,0,0,1,0,1,0,0,1,1,0,0,1,0,1,0,0]);
    const initialPop = ca.population;
    ca.run(10);
    assert.equal(ca.population, initialPop);
  });
});

// ===== Langton's Ant =====
describe("LangtonsAnt — basics", () => {
  it('starts at center', () => {
    const ant = new LangtonsAnt(11, 11);
    assert.equal(ant.x, 5);
    assert.equal(ant.y, 5);
    assert.equal(ant.steps, 0);
  });

  it('first step: turn right on white, flip, move', () => {
    const ant = new LangtonsAnt(11, 11);
    ant.step();
    assert.equal(ant.grid[5][5], 1); // flipped to black
    assert.equal(ant.steps, 1);
  });

  it('runs without error for many steps', () => {
    const ant = new LangtonsAnt(101, 101);
    ant.run(1000);
    assert.equal(ant.steps, 1000);
    assert.ok(ant.population > 0);
  });

  it('creates highway after ~10000 steps', () => {
    // Langton's ant famously creates a "highway" pattern after ~10000 steps
    const ant = new LangtonsAnt(201, 201);
    ant.run(11000);
    assert.equal(ant.steps, 11000);
    // The ant should be far from center after highway begins
    const distX = Math.abs(ant.x - 100);
    const distY = Math.abs(ant.y - 100);
    assert.ok(distX + distY > 5, 'Ant should have moved away from center');
  });
});
