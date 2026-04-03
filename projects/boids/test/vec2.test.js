const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vec2 } = require('../src/vec2.js');

// ─── Vec2 ───────────────────────────────────────────

test('Vec2: add', () => {
  const v = new Vec2(1, 2).add(new Vec2(3, 4));
  assert.equal(v.x, 4);
  assert.equal(v.y, 6);
});

test('Vec2: sub', () => {
  const v = new Vec2(5, 7).sub(new Vec2(2, 3));
  assert.equal(v.x, 3);
  assert.equal(v.y, 4);
});

test('Vec2: mul', () => {
  const v = new Vec2(3, 4).mul(2);
  assert.equal(v.x, 6);
  assert.equal(v.y, 8);
});

test('Vec2: div', () => {
  const v = new Vec2(6, 8).div(2);
  assert.equal(v.x, 3);
  assert.equal(v.y, 4);
});

test('Vec2: dot product', () => {
  assert.equal(new Vec2(1, 0).dot(new Vec2(0, 1)), 0);
  assert.equal(new Vec2(1, 2).dot(new Vec2(3, 4)), 11);
});

test('Vec2: length', () => {
  assert.ok(Math.abs(new Vec2(3, 4).length() - 5) < 1e-10);
});

test('Vec2: lengthSq', () => {
  assert.equal(new Vec2(3, 4).lengthSq(), 25);
});

test('Vec2: normalize', () => {
  const v = new Vec2(3, 4).normalize();
  assert.ok(Math.abs(v.length() - 1) < 1e-10);
  assert.ok(Math.abs(v.x - 0.6) < 1e-10);
  assert.ok(Math.abs(v.y - 0.8) < 1e-10);
});

test('Vec2: normalize zero vector', () => {
  const v = new Vec2(0, 0).normalize();
  assert.equal(v.x, 0);
  assert.equal(v.y, 0);
});

test('Vec2: limit', () => {
  const v = new Vec2(30, 40).limit(5);
  assert.ok(Math.abs(v.length() - 5) < 1e-10);
});

test('Vec2: limit does nothing if under max', () => {
  const v = new Vec2(1, 1).limit(10);
  assert.ok(Math.abs(v.x - 1) < 1e-10);
});

test('Vec2: dist', () => {
  assert.ok(Math.abs(new Vec2(0, 0).dist(new Vec2(3, 4)) - 5) < 1e-10);
});

test('Vec2: angle', () => {
  assert.ok(Math.abs(new Vec2(1, 0).angle()) < 1e-10);
  assert.ok(Math.abs(new Vec2(0, 1).angle() - Math.PI / 2) < 1e-10);
});

test('Vec2: fromAngle', () => {
  const v = Vec2.fromAngle(0, 5);
  assert.ok(Math.abs(v.x - 5) < 1e-10);
  assert.ok(Math.abs(v.y) < 1e-10);
});

test('Vec2: rotate', () => {
  const v = new Vec2(1, 0).rotate(Math.PI / 2);
  assert.ok(Math.abs(v.x) < 1e-10);
  assert.ok(Math.abs(v.y - 1) < 1e-10);
});

test('Vec2: clone', () => {
  const a = new Vec2(1, 2);
  const b = a.clone();
  assert.equal(b.x, 1);
  assert.equal(b.y, 2);
  assert.ok(a !== b);
});

test('Vec2: random', () => {
  const v = Vec2.random(100, 200);
  assert.ok(v.x >= 0 && v.x < 100);
  assert.ok(v.y >= 0 && v.y < 200);
});
