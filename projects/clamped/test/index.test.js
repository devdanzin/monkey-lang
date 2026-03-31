const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Clamped, Wrapped } = require('../src/index.js');

test('clamp — stays in bounds', () => {
  const c = new Clamped(50, 0, 100);
  assert.equal(c.value, 50);
  assert.equal(new Clamped(150, 0, 100).value, 100);
  assert.equal(new Clamped(-50, 0, 100).value, 0);
});

test('saturating arithmetic', () => {
  const c = new Clamped(90, 0, 100);
  assert.equal(c.add(20).value, 100); // saturates at max
  assert.equal(c.sub(200).value, 0);  // saturates at min
});

test('percentage', () => {
  const p = Clamped.percentage(75);
  assert.equal(p.value, 75);
  assert.equal(Clamped.percentage(150).value, 100);
  assert.equal(Clamped.percentage(-10).value, 0);
});

test('normalized', () => {
  const n = Clamped.normalized(0.5);
  assert.equal(n.value, 0.5);
  assert.equal(Clamped.normalized(2).value, 1);
});

test('byte', () => {
  assert.equal(Clamped.byte(128).value, 128);
  assert.equal(Clamped.byte(300).value, 255);
  assert.equal(Clamped.byte(-10).value, 0);
});

test('normalize', () => {
  const c = new Clamped(50, 0, 100);
  assert.equal(c.normalize(), 0.5);
});

test('lerp', () => {
  const c = new Clamped(0, 0, 100);
  assert.equal(c.lerp(100, 0.5).value, 50);
});

test('isAtMin / isAtMax', () => {
  assert.ok(new Clamped(-10, 0, 100).isAtMin());
  assert.ok(new Clamped(200, 0, 100).isAtMax());
});

test('wrapped — basic', () => {
  const w = new Wrapped(45, 0, 360);
  assert.equal(w.value, 45);
});

test('wrapped — wraps around', () => {
  assert.equal(new Wrapped(370, 0, 360).value, 10);
  assert.equal(new Wrapped(-10, 0, 360).value, 350);
  assert.equal(new Wrapped(720, 0, 360).value, 0);
});

test('wrapped — add/sub', () => {
  const w = new Wrapped(350, 0, 360);
  assert.equal(w.add(20).value, 10);
  assert.equal(w.sub(360).value, 350);
});

test('wrapped — distance', () => {
  const w = new Wrapped(10, 0, 360);
  assert.equal(w.distanceTo(20), 10);
  assert.equal(w.distanceTo(350), -20); // shorter to go backwards
});

test('angle convenience', () => {
  const a = Clamped.angle(400);
  assert.equal(a.value, 40);
});

test('map', () => {
  const c = new Clamped(50, 0, 100);
  assert.equal(c.map(x => x * 3).value, 100); // clamped
});
