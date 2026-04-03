const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Boid } = require('../src/boid.js');
const { Vec2 } = require('../src/vec2.js');

test('Boid: initial state', () => {
  const b = new Boid(100, 200, 1, 2);
  assert.equal(b.position.x, 100);
  assert.equal(b.position.y, 200);
  assert.equal(b.velocity.x, 1);
  assert.equal(b.velocity.y, 2);
});

test('Boid: applyForce accumulates', () => {
  const b = new Boid(0, 0);
  b.applyForce(new Vec2(1, 0));
  b.applyForce(new Vec2(0, 1));
  assert.equal(b.acceleration.x, 1);
  assert.equal(b.acceleration.y, 1);
});

test('Boid: update moves position', () => {
  const b = new Boid(0, 0, 2, 3);
  b.update(10, 1);
  assert.equal(b.position.x, 2);
  assert.equal(b.position.y, 3);
});

test('Boid: update respects maxSpeed', () => {
  const b = new Boid(0, 0, 100, 0);
  b.update(4, 1);
  assert.ok(b.velocity.length() <= 4 + 1e-10);
});

test('Boid: update applies acceleration', () => {
  const b = new Boid(0, 0, 0, 0);
  b.applyForce(new Vec2(1, 0));
  b.update(10, 1);
  assert.equal(b.velocity.x, 1);
  assert.equal(b.position.x, 1);
});

test('Boid: acceleration resets after update', () => {
  const b = new Boid(0, 0);
  b.applyForce(new Vec2(5, 5));
  b.update(10, 1);
  assert.equal(b.acceleration.x, 0);
  assert.equal(b.acceleration.y, 0);
});

test('Boid: wrapEdges wraps right', () => {
  const b = new Boid(810, 300);
  b.wrapEdges(800, 600);
  assert.equal(b.position.x, 10);
});

test('Boid: wrapEdges wraps left', () => {
  const b = new Boid(-10, 300);
  b.wrapEdges(800, 600);
  assert.equal(b.position.x, 790);
});

test('Boid: wrapEdges wraps top/bottom', () => {
  const b = new Boid(400, 610);
  b.wrapEdges(800, 600);
  assert.equal(b.position.y, 10);
});

test('Boid: heading', () => {
  const b = new Boid(0, 0, 1, 0);
  assert.ok(Math.abs(b.heading()) < 1e-10);
});
