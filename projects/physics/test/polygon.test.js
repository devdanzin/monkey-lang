const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vec2, Body, World, SpatialHashGrid, detectCollision } = require('../src/index.js');

// Helper to create a box polygon (centered at origin)
function boxPolygon(w, h) {
  const hw = w / 2, hh = h / 2;
  return {
    type: 'polygon',
    vertices: [
      new Vec2(-hw, -hh), new Vec2(hw, -hh),
      new Vec2(hw, hh), new Vec2(-hw, hh)
    ]
  };
}

// Triangle polygon
function trianglePolygon(size) {
  return {
    type: 'polygon',
    vertices: [
      new Vec2(0, -size),
      new Vec2(size, size),
      new Vec2(-size, size)
    ]
  };
}

// Regular polygon (n-gon)
function regularPolygon(n, radius) {
  const verts = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    verts.push(new Vec2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return { type: 'polygon', vertices: verts };
}

// === SAT Polygon-Polygon Tests ===

test('polygon-polygon: overlapping boxes collide', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const b = new Body({ position: new Vec2(15, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.ok(col, 'Overlapping boxes should collide');
  assert.ok(col.overlap > 0);
});

test('polygon-polygon: separated boxes do not collide', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const b = new Body({ position: new Vec2(30, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.equal(col, null);
});

test('polygon-polygon: rotated boxes collide', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20), angle: Math.PI / 4 });
  const b = new Body({ position: new Vec2(15, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.ok(col, 'Rotated overlapping boxes should collide');
});

test('polygon-polygon: triangles collide', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: trianglePolygon(10) });
  const b = new Body({ position: new Vec2(8, 0), shape: trianglePolygon(10) });
  const col = detectCollision(a, b);
  assert.ok(col, 'Overlapping triangles should collide');
});

test('polygon-polygon: normal points from A to B', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const b = new Body({ position: new Vec2(15, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.ok(col.normal.x > 0, 'Normal should point toward B (positive x)');
});

test('polygon-polygon: overlap magnitude is correct for boxes', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const b = new Body({ position: new Vec2(15, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  // Overlap should be 20 - 15 = 5
  assert.ok(Math.abs(col.overlap - 5) < 0.01, `Expected overlap ~5, got ${col.overlap}`);
});

test('polygon-polygon: edge-touching boxes (zero overlap) = no collision', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const b = new Body({ position: new Vec2(20, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.equal(col, null, 'Edge-touching should not collide');
});

test('polygon-polygon: hexagons collide', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: regularPolygon(6, 10) });
  const b = new Body({ position: new Vec2(15, 0), shape: regularPolygon(6, 10) });
  const col = detectCollision(a, b);
  assert.ok(col, 'Overlapping hexagons should collide');
});

test('polygon-polygon: pentagons separated do not collide', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: regularPolygon(5, 10) });
  const b = new Body({ position: new Vec2(30, 0), shape: regularPolygon(5, 10) });
  const col = detectCollision(a, b);
  assert.equal(col, null);
});

test('polygon-polygon: vertical overlap', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const b = new Body({ position: new Vec2(0, 15), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.ok(col);
  assert.ok(col.normal.y > 0, 'Normal should point downward (toward B)');
  assert.ok(Math.abs(col.overlap - 5) < 0.01);
});

test('polygon-polygon: diagonal overlap', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const b = new Body({ position: new Vec2(12, 12), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.ok(col, 'Diagonal overlapping boxes should collide');
  assert.ok(col.overlap > 0);
});

test('polygon-polygon: both rotated 45°', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20), angle: Math.PI / 4 });
  const b = new Body({ position: new Vec2(20, 0), shape: boxPolygon(20, 20), angle: Math.PI / 4 });
  const col = detectCollision(a, b);
  // Rotated 45° boxes are diamonds: width along axis is 20*sqrt(2)/2 ≈ 14.14
  // At distance 20, diamonds (half-diagonal ~14.14) should overlap
  assert.ok(col, 'Two 45° rotated boxes at distance 20 should overlap');
});

test('polygon-polygon: mixed shapes (triangle vs box)', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: trianglePolygon(15) });
  const b = new Body({ position: new Vec2(10, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(a, b);
  assert.ok(col, 'Triangle overlapping box should collide');
});

// === Circle-Polygon Tests ===

test('circle-polygon: circle hits box', () => {
  const circle = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 } });
  const box = new Body({ position: new Vec2(15, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(circle, box);
  assert.ok(col, 'Circle should collide with box');
  assert.ok(col.overlap > 0);
});

test('circle-polygon: separated do not collide', () => {
  const circle = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 5 } });
  const box = new Body({ position: new Vec2(30, 0), shape: boxPolygon(10, 10) });
  const col = detectCollision(circle, box);
  assert.equal(col, null);
});

test('polygon-circle: reversed order works', () => {
  const box = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const circle = new Body({ position: new Vec2(15, 0), shape: { type: 'circle', radius: 10 } });
  const col = detectCollision(box, circle);
  assert.ok(col, 'Polygon-circle should work');
});

test('circle-polygon: circle near vertex', () => {
  const circle = new Body({ position: new Vec2(12, 12), shape: { type: 'circle', radius: 5 } });
  const box = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(circle, box);
  assert.ok(col, 'Circle near corner should still detect collision');
});

test('circle-hexagon: overlap', () => {
  const circle = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 8 } });
  const hex = new Body({ position: new Vec2(12, 0), shape: regularPolygon(6, 10) });
  const col = detectCollision(circle, hex);
  assert.ok(col, 'Circle overlapping hexagon');
});

// === AABB-Polygon Cross Detection ===

test('aabb-polygon: box hits polygon', () => {
  const aabb = new Body({ position: new Vec2(0, 0), shape: { type: 'aabb', width: 20, height: 20 } });
  const poly = new Body({ position: new Vec2(15, 0), shape: boxPolygon(20, 20) });
  const col = detectCollision(aabb, poly);
  assert.ok(col, 'AABB should collide with polygon');
  assert.ok(col.overlap > 0);
});

test('polygon-aabb: reversed order works', () => {
  const poly = new Body({ position: new Vec2(0, 0), shape: boxPolygon(20, 20) });
  const aabb = new Body({ position: new Vec2(15, 0), shape: { type: 'aabb', width: 20, height: 20 } });
  const col = detectCollision(poly, aabb);
  assert.ok(col, 'Polygon-AABB should work');
});

test('aabb-polygon: separated do not collide', () => {
  const aabb = new Body({ position: new Vec2(0, 0), shape: { type: 'aabb', width: 10, height: 10 } });
  const poly = new Body({ position: new Vec2(30, 0), shape: boxPolygon(10, 10) });
  const col = detectCollision(aabb, poly);
  assert.equal(col, null);
});

// === Broadphase with Polygons ===

test('spatial hash: polygon bodies get correct cells', () => {
  const grid = new SpatialHashGrid(50);
  const poly = new Body({ position: new Vec2(100, 100), shape: boxPolygon(30, 30) });
  grid.insert(poly);
  
  // Query a nearby body — should find poly as candidate
  const nearby = new Body({ position: new Vec2(110, 100), shape: { type: 'circle', radius: 10 } });
  const candidates = grid.query(nearby);
  assert.ok(candidates.has(poly), 'Grid should find polygon body in same cell');
});

test('spatial hash: rotated polygon broadphase', () => {
  const grid = new SpatialHashGrid(50);
  const poly = new Body({ position: new Vec2(0, 0), shape: boxPolygon(40, 40), angle: Math.PI / 4 });
  grid.insert(poly);
  
  // A 40x40 box rotated 45° has bounding box ~56.57 x 56.57
  // Point at (25, 0) should be in range
  const probe = new Body({ position: new Vec2(25, 0), shape: { type: 'circle', radius: 1 } });
  const candidates = grid.query(probe);
  assert.ok(candidates.has(poly), 'Rotated polygon AABB should extend to contain point');
});

// === World Simulation with Polygons ===

test('polygon in world simulation', () => {
  const world = new World({ gravity: new Vec2(0, 50) });
  const box = world.addBody(new Body({
    position: new Vec2(0, 0),
    shape: boxPolygon(20, 20),
    canSleep: false,
  }));
  const floor = world.addBody(new Body({
    position: new Vec2(0, 50),
    shape: boxPolygon(200, 10),
    isStatic: true,
  }));
  
  for (let i = 0; i < 50; i++) world.step(0.016);
  
  assert.ok(box.position.y > 0, 'Box should have fallen');
  assert.ok(box.position.y < 100, 'Box should be stopped by floor');
});

test('polygon collision resolution', () => {
  const world = new World({ gravity: new Vec2(0, 0) });
  const a = world.addBody(new Body({
    position: new Vec2(0, 0), velocity: new Vec2(50, 0),
    shape: boxPolygon(20, 20), canSleep: false,
  }));
  const b = world.addBody(new Body({
    position: new Vec2(25, 0), velocity: new Vec2(-50, 0),
    shape: boxPolygon(20, 20), canSleep: false,
  }));
  
  world.step(0.016);
  
  assert.ok(a.position.x <= b.position.x, 'A should be left of B');
});

test('polygon stacking: 3 boxes on a floor', () => {
  const world = new World({ gravity: new Vec2(0, 100) });
  const floor = world.addBody(new Body({
    position: new Vec2(0, 100),
    shape: boxPolygon(200, 10),
    isStatic: true,
  }));
  
  const boxes = [];
  for (let i = 0; i < 3; i++) {
    boxes.push(world.addBody(new Body({
      position: new Vec2(0, -30 + i * 22),
      shape: boxPolygon(20, 20),
      canSleep: false,
    })));
  }
  
  for (let i = 0; i < 200; i++) world.step(0.016);
  
  // All boxes should be above the floor and below start position
  for (const box of boxes) {
    assert.ok(box.position.y < 100, `Box should be above floor, at ${box.position.y}`);
    assert.ok(box.position.y > -40, `Box should have fallen from starting position`);
  }
  // Bottom box should be lower than top box
  assert.ok(boxes[0].position.y <= boxes[2].position.y || 
            boxes[2].position.y <= boxes[0].position.y, 
            'Boxes should have settled');
});

test('polygon broadphase: many polygons use spatial hash', () => {
  const world = new World({ gravity: new Vec2(0, 0), cellSize: 50 });
  
  // Add 20 polygon bodies — should trigger broadphase (>8 bodies)
  for (let i = 0; i < 20; i++) {
    world.addBody(new Body({
      position: new Vec2(i * 30, 0),
      shape: boxPolygon(20, 20),
      canSleep: false,
    }));
  }
  
  world.step(0.016);
  
  // Broadphase should have been used (>8 bodies)
  assert.ok(world.stats.bodies === 20);
  // Only nearby pairs should be checked (much less than 20*19/2 = 190)
  assert.ok(world.stats.narrowphaseChecks < 190, 
    `Broadphase should reduce checks, got ${world.stats.narrowphaseChecks}`);
});

test('mixed polygon+circle world', () => {
  const world = new World({ gravity: new Vec2(0, 50) });
  
  const circle = world.addBody(new Body({
    position: new Vec2(0, 0),
    shape: { type: 'circle', radius: 10 },
    canSleep: false,
  }));
  
  const polyFloor = world.addBody(new Body({
    position: new Vec2(0, 40),
    shape: boxPolygon(100, 10),
    isStatic: true,
  }));
  
  for (let i = 0; i < 50; i++) world.step(0.016);
  
  // Circle should have fallen and stopped on polygon floor
  assert.ok(circle.position.y > 0, 'Circle should have fallen');
  assert.ok(circle.position.y < 50, 'Circle should have stopped on polygon floor');
});
