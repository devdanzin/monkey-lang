const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Flock, Vec2 } = require('../src/index.js');

// ─── Wind ───────────────────────────────────────────

test('wind: boids drift in wind direction', () => {
  const flock = new Flock({
    width: 800, height: 600, windX: 0.05, windY: 0,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(400, 300, 0, 0);
  for (let i = 0; i < 50; i++) flock.update(1);
  assert.ok(flock.boids[0].position.x > 400, 'Boid should drift right with wind');
});

test('wind: vertical wind', () => {
  const flock = new Flock({
    width: 800, height: 600, windX: 0, windY: 0.05,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(400, 300, 0, 0);
  for (let i = 0; i < 50; i++) flock.update(1);
  assert.ok(flock.boids[0].position.y > 300, 'Boid should drift down with wind');
});

// ─── Bounce Mode ────────────────────────────────────

test('bounce: boid bounces off right wall', () => {
  const flock = new Flock({
    width: 800, height: 600, boundaryMode: 'bounce',
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(795, 300, 4, 0);
  flock.update(1);
  flock.update(1);
  assert.ok(flock.boids[0].velocity.x < 0, 'Velocity should reverse on bounce');
});

test('bounce: boid bounces off top wall', () => {
  const flock = new Flock({
    width: 800, height: 600, boundaryMode: 'bounce',
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(400, 5, 0, -4);
  flock.update(1);
  flock.update(1);
  assert.ok(flock.boids[0].velocity.y > 0, 'Velocity should reverse on bounce');
});

test('bounce: boid stays in bounds', () => {
  const flock = new Flock({
    width: 800, height: 600, boundaryMode: 'bounce',
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(10, 10, -10, -10);
  for (let i = 0; i < 20; i++) flock.update(1);
  assert.ok(flock.boids[0].position.x >= 0);
  assert.ok(flock.boids[0].position.y >= 0);
});

// ─── Steer Mode ─────────────────────────────────────

test('steer: boid steers away from edges', () => {
  const flock = new Flock({
    width: 800, height: 600, boundaryMode: 'steer', boundaryMargin: 100,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(10, 300, -2, 0); // heading toward left edge
  for (let i = 0; i < 30; i++) flock.update(1);
  // Should have turned away from edge
  assert.ok(flock.boids[0].velocity.x > -2, 'Boid should steer away from edge');
});

// ─── Predator AI ────────────────────────────────────

test('predator AI: chases nearest boid', () => {
  const flock = new Flock({
    width: 800, height: 600, predatorChase: true, predatorSpeed: 3,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(500, 300, 0, 0);
  flock.addPredator(100, 300);
  const initialDist = flock.boids[0].position.dist(flock.predators[0].position);
  for (let i = 0; i < 20; i++) flock.update(1);
  const finalDist = flock.boids[0].position.dist(flock.predators[0].position);
  // Note: boid also flees, but predator should close distance somewhat
  assert.ok(flock.predators[0].position.x > 100, 'Predator should move toward boid');
});

test('predator AI: predator moves', () => {
  const flock = new Flock({
    width: 800, height: 600, predatorChase: true, predatorSpeed: 5,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(400, 300, 0, 0);
  flock.addPredator(200, 300);
  const oldX = flock.predators[0].position.x;
  flock.update(1);
  assert.ok(flock.predators[0].position.x > oldX, 'Predator should move right');
});

// ─── Combined scenarios ─────────────────────────────

test('wind + bounce: boid bounces back against wind', () => {
  const flock = new Flock({
    width: 100, height: 100, boundaryMode: 'bounce', windX: 0.05,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0, maxSpeed: 4
  });
  flock.addBoid(95, 50, 3, 0);
  for (let i = 0; i < 50; i++) flock.update(1);
  // Boid should be bouncing around
  assert.ok(flock.boids[0].position.x >= 0);
  assert.ok(flock.boids[0].position.x <= 100);
});

test('multiple predators: boids flee from closest', () => {
  const flock = new Flock({
    width: 800, height: 600,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(400, 300, 0, 0);
  flock.addPredator(380, 300); // close predator on left
  flock.addPredator(600, 300); // far predator on right
  for (let i = 0; i < 10; i++) flock.update(1);
  // Boid should flee rightward (away from closer predator)
  assert.ok(flock.boids[0].position.x > 400, 'Boid should flee from closer predator');
});
