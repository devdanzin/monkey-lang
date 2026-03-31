const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vec2, Body, World } = require('../src/index.js');

test('body falls asleep when stationary', () => {
  const body = new Body({
    position: new Vec2(0, 0),
    velocity: new Vec2(0.1, 0),
    friction: 5, // high friction to slow quickly
    sleepThreshold: 0.5,
    sleepDelay: 0.1,
  });
  
  // Simulate until asleep
  for (let i = 0; i < 100; i++) {
    body.update(0.016);
  }
  
  assert.ok(body.isSleeping, 'Body should be sleeping after slowing down');
  assert.equal(body.velocity.x, 0);
  assert.equal(body.velocity.y, 0);
});

test('sleeping body does not move', () => {
  const body = new Body({ position: new Vec2(5, 5) });
  body.sleep();
  
  const posBefore = { x: body.position.x, y: body.position.y };
  body.update(1);
  
  assert.equal(body.position.x, posBefore.x);
  assert.equal(body.position.y, posBefore.y);
});

test('wake() reactivates sleeping body', () => {
  const body = new Body({ position: new Vec2(0, 0) });
  body.sleep();
  assert.ok(body.isSleeping);
  
  body.wake();
  assert.ok(!body.isSleeping);
  assert.equal(body.sleepTimer, 0);
});

test('applyForce wakes sleeping body', () => {
  const body = new Body({ position: new Vec2(0, 0) });
  body.sleep();
  
  body.applyForce(new Vec2(10, 0));
  assert.ok(!body.isSleeping, 'Force should wake the body');
});

test('collision wakes sleeping body', () => {
  const world = new World({ gravity: new Vec2(0, 0) });
  
  const sleeper = world.addBody(new Body({
    position: new Vec2(0, 0),
    shape: { type: 'circle', radius: 10 },
  }));
  sleeper.sleep();
  
  const mover = world.addBody(new Body({
    position: new Vec2(18, 0),
    velocity: new Vec2(-50, 0),
    shape: { type: 'circle', radius: 10 },
  }));
  
  world.step(0.016);
  // Mover should collide with sleeper and wake it
  assert.ok(!sleeper.isSleeping, 'Collision should wake sleeping body');
});

test('canSleep: false prevents sleeping', () => {
  const body = new Body({
    velocity: new Vec2(0.01, 0),
    friction: 10,
    canSleep: false,
    sleepDelay: 0,
  });
  
  for (let i = 0; i < 100; i++) body.update(0.016);
  
  assert.ok(!body.isSleeping, 'Body with canSleep:false should never sleep');
});

test('sleeping reduces collision checks', () => {
  const world = new World({ gravity: new Vec2(0, 0), broadphase: false });
  
  // Add 10 sleeping bodies + 2 active
  for (let i = 0; i < 10; i++) {
    const b = world.addBody(new Body({
      position: new Vec2(i * 100, 0),
      shape: { type: 'circle', radius: 5 },
    }));
    b.sleep();
  }
  world.addBody(new Body({
    position: new Vec2(0, 50),
    velocity: new Vec2(10, 0),
    shape: { type: 'circle', radius: 5 },
  }));
  world.addBody(new Body({
    position: new Vec2(0, -50),
    velocity: new Vec2(-10, 0),
    shape: { type: 'circle', radius: 5 },
  }));
  
  world.step(0.016);
  
  // With 12 bodies, naive would be 66 pairs. Sleeping optimization should skip many.
  const naivePairs = 12 * 11 / 2; // 66
  assert.ok(world.stats.narrowphaseChecks < naivePairs,
    `Checks: ${world.stats.narrowphaseChecks} should be less than ${naivePairs}`);
});
