const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vec2, Body, sweepTest } = require('../src/index.js');

test('sweepTest detects collision for fast object', () => {
  const moving = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(100, 0),
    shape: { type: 'circle', radius: 5 },
  });
  const wall = new Body({
    position: new Vec2(50, 0),
    shape: { type: 'circle', radius: 5 },
    isStatic: true,
  });
  
  const hit = sweepTest(moving, wall, 1.0);
  assert.ok(hit, 'Should detect collision');
  assert.ok(hit.time >= 0 && hit.time <= 1, `time: ${hit.time}`);
  assert.ok(hit.time < 0.5, `Should hit before halfway: ${hit.time}`);
});

test('sweepTest misses when object moves away', () => {
  const moving = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(-100, 0), // moving away
    shape: { type: 'circle', radius: 5 },
  });
  const wall = new Body({
    position: new Vec2(50, 0),
    shape: { type: 'circle', radius: 5 },
  });
  
  const hit = sweepTest(moving, wall, 1.0);
  assert.equal(hit, null);
});

test('sweepTest detects tunnel-through', () => {
  // Object moving so fast it would pass through a thin wall
  const moving = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(1000, 0), // Very fast
    shape: { type: 'circle', radius: 2 },
  });
  const thinWall = new Body({
    position: new Vec2(100, 0),
    shape: { type: 'circle', radius: 1 }, // Very thin
  });
  
  // Without CCD: position would jump from 0 to 1000, missing the wall
  // With CCD: sweep test detects the collision
  const hit = sweepTest(moving, thinWall, 1.0);
  assert.ok(hit, 'CCD should detect tunneling');
});

test('sweepTest returns collision time', () => {
  const moving = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(100, 0),
    shape: { type: 'circle', radius: 0 }, // point
  });
  const target = new Body({
    position: new Vec2(50, 0),
    shape: { type: 'circle', radius: 10 },
  });
  
  const hit = sweepTest(moving, target, 1.0);
  assert.ok(hit);
  // Should hit at t ≈ 0.4 (when point reaches edge of radius 10 circle at x=50)
  // Distance to edge = 50 - 10 = 40, velocity = 100, t = 40/100 = 0.4
  assert.ok(Math.abs(hit.time - 0.4) < 0.05, `time: ${hit.time}`);
});

test('sweepTest returns normal', () => {
  const moving = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(100, 0),
    shape: { type: 'circle', radius: 5 },
  });
  const target = new Body({
    position: new Vec2(50, 0),
    shape: { type: 'circle', radius: 5 },
  });
  
  const hit = sweepTest(moving, target, 1.0);
  assert.ok(hit);
  assert.ok(hit.normal.x < 0, 'Normal should point back toward moving body');
});

test('sweepTest handles already overlapping', () => {
  const moving = new Body({
    position: new Vec2(5, 0),
    velocity: new Vec2(100, 0),
    shape: { type: 'circle', radius: 10 },
  });
  const target = new Body({
    position: new Vec2(10, 0),
    shape: { type: 'circle', radius: 10 },
  });
  
  const hit = sweepTest(moving, target, 1.0);
  assert.ok(hit);
  assert.equal(hit.time, 0); // Already colliding
});

test('sweepTest with diagonal motion', () => {
  const moving = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(50, 50),
    shape: { type: 'circle', radius: 5 },
  });
  const target = new Body({
    position: new Vec2(30, 30),
    shape: { type: 'circle', radius: 5 },
  });
  
  const hit = sweepTest(moving, target, 1.0);
  assert.ok(hit, 'Should detect diagonal collision');
});

test('sweepTest stationary object returns null', () => {
  const moving = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(0, 0), // not moving
    shape: { type: 'circle', radius: 5 },
  });
  const target = new Body({
    position: new Vec2(50, 0),
    shape: { type: 'circle', radius: 5 },
  });
  
  const hit = sweepTest(moving, target, 1.0);
  assert.equal(hit, null);
});
