const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Flock, Vec2 } = require('../src/index.js');

// ─── Flock Creation ─────────────────────────────────

test('Flock: create empty', () => {
  const flock = new Flock();
  assert.equal(flock.boids.length, 0);
});

test('Flock: add boid', () => {
  const flock = new Flock();
  flock.addBoid(100, 200, 1, 0);
  assert.equal(flock.boids.length, 1);
  assert.equal(flock.boids[0].position.x, 100);
});

test('Flock: add random boids', () => {
  const flock = new Flock({ width: 800, height: 600 });
  flock.addRandomBoids(50);
  assert.equal(flock.boids.length, 50);
});

test('Flock: add obstacle', () => {
  const flock = new Flock();
  flock.addObstacle(400, 300, 50);
  assert.equal(flock.obstacles.length, 1);
  assert.equal(flock.obstacles[0].radius, 50);
});

test('Flock: add predator', () => {
  const flock = new Flock();
  flock.addPredator(400, 300);
  assert.equal(flock.predators.length, 1);
});

// ─── Simulation Step ────────────────────────────────

test('Flock: update moves boids', () => {
  const flock = new Flock({ width: 800, height: 600 });
  flock.addBoid(100, 100, 2, 0);
  const oldX = flock.boids[0].position.x;
  flock.update(1);
  assert.ok(flock.boids[0].position.x !== oldX);
});

test('Flock: boids stay in bounds after update', () => {
  const flock = new Flock({ width: 800, height: 600 });
  flock.addBoid(799, 599, 10, 10);
  for (let i = 0; i < 10; i++) flock.update(1);
  assert.ok(flock.boids[0].position.x >= 0);
  assert.ok(flock.boids[0].position.x <= 800);
});

// ─── Separation ─────────────────────────────────────

test('separation: boids move apart when too close', () => {
  const flock = new Flock({
    width: 800, height: 600,
    separationRadius: 50, separationWeight: 2,
    alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(100, 100, 0, 0);
  flock.addBoid(105, 100, 0, 0); // very close
  
  for (let i = 0; i < 20; i++) flock.update(1);
  
  const dist = flock.boids[0].position.dist(flock.boids[1].position);
  assert.ok(dist > 5, `Expected boids to separate, got dist=${dist}`);
});

// ─── Alignment ──────────────────────────────────────

test('alignment: boids align velocities', () => {
  const flock = new Flock({
    width: 800, height: 600,
    alignmentRadius: 100, alignmentWeight: 2,
    separationWeight: 0, cohesionWeight: 0,
    maxSpeed: 4
  });
  // Two boids close together, different velocities
  flock.addBoid(100, 100, 3, 0);  // moving right
  flock.addBoid(120, 100, 0, 3);  // moving down
  
  for (let i = 0; i < 50; i++) flock.update(1);
  
  // After alignment, headings should be closer
  const h1 = flock.boids[0].velocity.normalize();
  const h2 = flock.boids[1].velocity.normalize();
  const dot = h1.dot(h2);
  assert.ok(dot > 0.5, `Expected alignment (dot > 0.5), got ${dot}`);
});

// ─── Cohesion ───────────────────────────────────────

test('cohesion: boids move toward group center', () => {
  const flock = new Flock({
    width: 800, height: 600,
    cohesionRadius: 500, cohesionWeight: 2,
    separationWeight: 0, alignmentWeight: 0,
    maxSpeed: 4, maxForce: 0.2
  });
  flock.addBoid(100, 300, 0, 0);
  flock.addBoid(400, 300, 0, 0);
  
  const initialDist = flock.boids[0].position.dist(flock.boids[1].position);
  for (let i = 0; i < 50; i++) flock.update(1);
  const finalDist = flock.boids[0].position.dist(flock.boids[1].position);
  
  assert.ok(finalDist < initialDist, `Expected boids to converge: ${initialDist} -> ${finalDist}`);
});

// ─── Stats ──────────────────────────────────────────

test('stats: avgSpeed', () => {
  const flock = new Flock();
  flock.addBoid(0, 0, 3, 4); // speed = 5
  flock.addBoid(0, 0, 0, 5); // speed = 5
  assert.equal(flock.avgSpeed(), 5);
});

test('stats: centerOfMass', () => {
  const flock = new Flock();
  flock.addBoid(0, 0);
  flock.addBoid(100, 0);
  flock.addBoid(0, 100);
  flock.addBoid(100, 100);
  const cm = flock.centerOfMass();
  assert.equal(cm.x, 50);
  assert.equal(cm.y, 50);
});

test('stats: avgAlignment with same direction', () => {
  const flock = new Flock();
  flock.addBoid(0, 0, 1, 0);
  flock.addBoid(50, 50, 2, 0);
  assert.ok(flock.avgAlignment() > 0.99);
});

test('stats: avgAlignment with random directions', () => {
  const flock = new Flock();
  flock.addBoid(0, 0, 1, 0);
  flock.addBoid(50, 50, -1, 0);
  assert.ok(flock.avgAlignment() < 0.01);
});

test('stats: empty flock', () => {
  const flock = new Flock();
  assert.equal(flock.avgSpeed(), 0);
  assert.equal(flock.avgAlignment(), 0);
});

// ─── Emergent Behavior ──────────────────────────────

test('emergent: flock aligns over time', () => {
  const flock = new Flock({
    width: 400, height: 400,
    separationRadius: 20, alignmentRadius: 60, cohesionRadius: 60,
    separationWeight: 1.5, alignmentWeight: 1.0, cohesionWeight: 1.0,
    maxSpeed: 3, maxForce: 0.1
  });
  // Start with random boids
  for (let i = 0; i < 30; i++) {
    const x = 150 + Math.random() * 100;
    const y = 150 + Math.random() * 100;
    const angle = Math.random() * Math.PI * 2;
    flock.addBoid(x, y, Math.cos(angle) * 2, Math.sin(angle) * 2);
  }
  
  const initialAlignment = flock.avgAlignment();
  
  // Run for many steps
  for (let i = 0; i < 200; i++) flock.update(1);
  
  const finalAlignment = flock.avgAlignment();
  // Alignment should increase (boids align over time)
  assert.ok(finalAlignment > initialAlignment,
    `Expected alignment to increase: ${initialAlignment.toFixed(3)} -> ${finalAlignment.toFixed(3)}`);
});

test('emergent: separation maintains minimum distance', () => {
  const flock = new Flock({
    width: 400, height: 400,
    separationRadius: 30, separationWeight: 2.0,
    alignmentWeight: 0.5, cohesionWeight: 0.5,
    maxSpeed: 3, maxForce: 0.15
  });
  // Start all boids at same point
  for (let i = 0; i < 20; i++) {
    flock.addBoid(200, 200, Math.random() * 2 - 1, Math.random() * 2 - 1);
  }
  
  for (let i = 0; i < 100; i++) flock.update(1);
  
  // After separation, no two boids should be very close
  let minDist = Infinity;
  for (let i = 0; i < flock.boids.length; i++) {
    for (let j = i + 1; j < flock.boids.length; j++) {
      const d = flock.boids[i].position.dist(flock.boids[j].position);
      minDist = Math.min(minDist, d);
    }
  }
  assert.ok(minDist > 5, `Expected min distance > 5, got ${minDist.toFixed(2)}`);
});

// ─── Predator Avoidance ─────────────────────────────

test('predator: boids flee from predator', () => {
  const flock = new Flock({
    width: 800, height: 600,
    separationWeight: 0, alignmentWeight: 0, cohesionWeight: 0
  });
  flock.addBoid(400, 300, 0, 0);
  flock.addPredator(400, 310); // predator just below boid
  
  for (let i = 0; i < 10; i++) flock.update(1);
  
  // Boid should have moved away (upward)
  assert.ok(flock.boids[0].position.y < 300,
    `Expected boid to flee upward, y=${flock.boids[0].position.y}`);
});
