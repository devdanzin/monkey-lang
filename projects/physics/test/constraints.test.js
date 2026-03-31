const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vec2, Body, World, DistanceConstraint, SpringConstraint } = require('../src/index.js');

test('DistanceConstraint maintains distance', () => {
  const world = new World({ gravity: new Vec2(0, 0) });
  const a = world.addBody(new Body({ position: new Vec2(0, 0), isStatic: true }));
  const b = world.addBody(new Body({ position: new Vec2(10, 0) }));
  
  const constraint = world.addConstraint(new DistanceConstraint(a, b, { distance: 10, stiffness: 1 }));
  
  // Push b away
  b.position = new Vec2(20, 0);
  world.step(0.016);
  
  // Should be pulled back toward 10 units away
  const dist = a.position.distance(b.position);
  assert.ok(Math.abs(dist - 10) < 2, `Distance should be ~10, got ${dist}`);
});

test('DistanceConstraint with two free bodies', () => {
  const world = new World({ gravity: new Vec2(0, 0), constraintIterations: 8 });
  const a = world.addBody(new Body({ position: new Vec2(0, 0) }));
  const b = world.addBody(new Body({ position: new Vec2(20, 0) }));
  
  world.addConstraint(new DistanceConstraint(a, b, { distance: 5, stiffness: 1 }));
  
  // Multiple steps to converge
  for (let i = 0; i < 10; i++) world.step(0.016);
  
  const dist = a.position.distance(b.position);
  assert.ok(Math.abs(dist - 5) < 1, `Distance should converge to ~5, got ${dist}`);
});

test('DistanceConstraint pendulum', () => {
  const world = new World({ gravity: new Vec2(0, 50), constraintIterations: 8 });
  const pivot = world.addBody(new Body({ position: new Vec2(0, 0), isStatic: true }));
  const bob = world.addBody(new Body({ position: new Vec2(5, 0) }));
  
  world.addConstraint(new DistanceConstraint(pivot, bob, { distance: 5 }));
  
  // Simulate — bob should swing under gravity while maintaining distance
  for (let i = 0; i < 100; i++) {
    world.step(0.016);
  }
  
  const dist = pivot.position.distance(bob.position);
  assert.ok(Math.abs(dist - 5) < 1, `Pendulum should maintain distance ~5, got ${dist}`);
  assert.ok(bob.position.y > 0, 'Bob should swing downward');
});

test('SpringConstraint: oscillation', () => {
  const world = new World({ gravity: new Vec2(0, 0) });
  const anchor = world.addBody(new Body({ position: new Vec2(0, 0), isStatic: true, shape: { type: 'circle', radius: 1 } }));
  const mass = world.addBody(new Body({ position: new Vec2(15, 0), shape: { type: 'circle', radius: 1 } }));
  
  world.addSpring(new SpringConstraint(anchor, mass, { 
    restLength: 10, stiffness: 100, damping: 0.5 
  }));
  
  const positions = [];
  for (let i = 0; i < 200; i++) {
    world.step(0.016);
    if (i % 20 === 0) positions.push(mass.position.x);
  }
  
  // Should oscillate (not monotonically increasing/decreasing)
  let dirChanges = 0;
  for (let i = 2; i < positions.length; i++) {
    const d1 = positions[i-1] - positions[i-2];
    const d2 = positions[i] - positions[i-1];
    if (d1 * d2 < 0) dirChanges++;
  }
  assert.ok(dirChanges >= 1, `Spring should oscillate, direction changes: ${dirChanges}`);
});

test('SpringConstraint: damping reduces amplitude', () => {
  const world = new World({ gravity: new Vec2(0, 0) });
  const anchor = world.addBody(new Body({ position: new Vec2(0, 0), isStatic: true, shape: { type: 'circle', radius: 1 } }));
  const mass = world.addBody(new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 1 } }));
  
  world.addSpring(new SpringConstraint(anchor, mass, { 
    restLength: 10, stiffness: 50, damping: 5 
  }));
  
  // Record max displacement at different times
  let earlyMax = 0, lateMax = 0;
  for (let i = 0; i < 500; i++) {
    world.step(0.016);
    const disp = Math.abs(mass.position.x - 10); // distance from rest
    if (i < 100) earlyMax = Math.max(earlyMax, disp);
    if (i > 300) lateMax = Math.max(lateMax, disp);
  }
  
  // Late amplitude should be less than early amplitude (damping)
  assert.ok(lateMax < earlyMax, `Damping should reduce: late=${lateMax.toFixed(2)}, early=${earlyMax.toFixed(2)}`);
});

test('SpringConstraint: restLength behavior', () => {
  const world = new World({ gravity: new Vec2(0, 0) });
  const a = world.addBody(new Body({ position: new Vec2(0, 0), isStatic: true }));
  const b = world.addBody(new Body({ position: new Vec2(5, 0) }));
  
  // Rest length = 10, body starts at 5 — should be pushed outward
  world.addSpring(new SpringConstraint(a, b, { restLength: 10, stiffness: 50, damping: 2 }));
  
  world.step(0.016);
  // Spring should push b away (it's closer than rest length)
  assert.ok(b.velocity.x > 0, `Body should be pushed outward: vx=${b.velocity.x}`);
});

test('chain of constraints', () => {
  const world = new World({ gravity: new Vec2(0, 50), constraintIterations: 8 });
  
  // Build a chain: fixed anchor → 5 connected bodies
  const bodies = [];
  const anchor = world.addBody(new Body({ position: new Vec2(0, 0), isStatic: true }));
  bodies.push(anchor);
  
  for (let i = 1; i <= 5; i++) {
    const body = world.addBody(new Body({ position: new Vec2(i * 3, 0) }));
    world.addConstraint(new DistanceConstraint(bodies[i-1], body, { distance: 3 }));
    bodies.push(body);
  }
  
  // Simulate
  for (let i = 0; i < 100; i++) {
    world.step(0.016);
  }
  
  // Chain should hang downward
  assert.ok(bodies[5].position.y > 0, 'Chain end should hang down');
  
  // Each link should maintain approximate distance
  for (let i = 1; i <= 5; i++) {
    const dist = bodies[i-1].position.distance(bodies[i].position);
    assert.ok(Math.abs(dist - 3) < 1.5, `Link ${i} distance: ${dist}`);
  }
});

test('World stats includes constraints and springs', () => {
  const world = new World({ gravity: new Vec2(0, 0) });
  const a = world.addBody(new Body());
  const b = world.addBody(new Body());
  
  world.addConstraint(new DistanceConstraint(a, b));
  world.addSpring(new SpringConstraint(a, b));
  
  const stats = world.stats;
  assert.equal(stats.constraints, 1);
  assert.equal(stats.springs, 1);
});
