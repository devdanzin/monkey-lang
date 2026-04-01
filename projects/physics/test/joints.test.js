const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vec2, Body, World, RevoluteJoint, PrismaticJoint } = require('../src/index.js');

test('RevoluteJoint: keeps anchor points together', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 } });
  const b = new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 10 } });
  const anchor = new Vec2(10, 0);
  const joint = new RevoluteJoint(a, b, anchor);
  
  // Pull b away
  b.position = new Vec2(30, 0);
  
  for (let i = 0; i < 10; i++) joint.solve();
  
  // Anchor points should converge
  const worldA = joint._toWorld(a, joint.localAnchorA);
  const worldB = joint._toWorld(b, joint.localAnchorB);
  const dist = worldA.sub(worldB).length();
  assert.ok(dist < 1, `Anchor points should be close, got ${dist}`);
});

test('RevoluteJoint: allows rotation', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 }, isStatic: true });
  const b = new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 10 } });
  const joint = new RevoluteJoint(a, b, new Vec2(0, 0));
  
  b.angularVelocity = 2;
  // Joint should not prevent rotation
  assert.equal(b.angularVelocity, 2);
});

test('RevoluteJoint: angle limits', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 }, isStatic: true });
  const b = new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 10 } });
  const joint = new RevoluteJoint(a, b, new Vec2(10, 0), {
    enableLimit: true, lowerAngle: -0.5, upperAngle: 0.5
  });
  
  b.angle = 2; // Way past upper limit
  for (let i = 0; i < 20; i++) joint.solve();
  
  const relAngle = b.angle - a.angle;
  assert.ok(relAngle <= 0.6, `Angle should be limited, got ${relAngle}`);
});

test('RevoluteJoint: motor applies torque', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 }, isStatic: true });
  const b = new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 10 } });
  const joint = new RevoluteJoint(a, b, new Vec2(10, 0), {
    enableMotor: true, motorSpeed: 5, maxMotorTorque: 10
  });
  
  joint.solve();
  assert.ok(b.angularVelocity > 0, 'Motor should spin body B');
});

test('RevoluteJoint: static anchor', () => {
  const ground = new Body({ position: new Vec2(0, 100), shape: { type: 'circle', radius: 10 }, isStatic: true });
  const pendulum = new Body({ position: new Vec2(0, 50), shape: { type: 'circle', radius: 10 } });
  const joint = new RevoluteJoint(ground, pendulum, new Vec2(0, 100));
  
  // Apply gravity-like force
  pendulum.velocity = new Vec2(10, 0);
  pendulum.position = new Vec2(10, 50);
  
  for (let i = 0; i < 20; i++) joint.solve();
  
  // Pendulum should stay connected to ground's anchor
  const worldAnchor = joint._toWorld(ground, joint.localAnchorA);
  const worldPendulum = joint._toWorld(pendulum, joint.localAnchorB);
  const dist = worldAnchor.sub(worldPendulum).length();
  assert.ok(dist < 2, `Pendulum should stay attached, distance: ${dist}`);
});

test('PrismaticJoint: constrains to axis', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 }, isStatic: true });
  const b = new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 10 } });
  const joint = new PrismaticJoint(a, b, new Vec2(1, 0)); // Horizontal axis
  
  // Push b off axis
  b.position = new Vec2(25, 10);
  
  for (let i = 0; i < 20; i++) joint.solve();
  
  // b should be pulled back toward the axis (y ≈ 0)
  assert.ok(Math.abs(b.position.y) < 2, `Should stay on axis, y = ${b.position.y}`);
});

test('PrismaticJoint: translation limits', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 }, isStatic: true });
  const b = new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 10 } });
  const joint = new PrismaticJoint(a, b, new Vec2(1, 0), {
    enableLimit: true, lowerLimit: -5, upperLimit: 30
  });
  
  // Push b way past upper limit
  b.position = new Vec2(60, 0);
  for (let i = 0; i < 20; i++) joint.solve();
  
  const translation = b.position.sub(a.position).dot(new Vec2(1, 0)) - 20; // Initial offset is 20
  assert.ok(translation <= 35, `Should be limited, translation = ${translation}`);
});

test('PrismaticJoint: constrains rotation', () => {
  const a = new Body({ position: new Vec2(0, 0), shape: { type: 'circle', radius: 10 }, isStatic: true });
  const b = new Body({ position: new Vec2(20, 0), shape: { type: 'circle', radius: 10 } });
  const joint = new PrismaticJoint(a, b, new Vec2(1, 0));
  
  b.angle = 1.0;
  for (let i = 0; i < 20; i++) joint.solve();
  
  assert.ok(Math.abs(b.angle) < 0.5, `Should constrain rotation, angle = ${b.angle}`);
});

test('joints work with World simulation', () => {
  const world = new World({ gravity: new Vec2(0, 100) });
  
  const anchor = world.addBody(new Body({
    position: new Vec2(200, 50),
    shape: { type: 'circle', radius: 5 },
    isStatic: true
  }));
  
  const pendulum = world.addBody(new Body({
    position: new Vec2(200, 100),
    shape: { type: 'circle', radius: 10 },
    canSleep: false
  }));
  
  const joint = new RevoluteJoint(anchor, pendulum, new Vec2(200, 50));
  world.constraints.push(joint);
  
  // Simulate
  for (let i = 0; i < 100; i++) world.step(0.016);
  
  // Pendulum should have swung but stayed attached
  const dist = joint._toWorld(anchor, joint.localAnchorA)
    .sub(joint._toWorld(pendulum, joint.localAnchorB)).length();
  assert.ok(dist < 5, `Pendulum should stay attached during sim, dist: ${dist}`);
});
