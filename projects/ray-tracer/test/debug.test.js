import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Ray, Sphere, HittableList, Lambertian, Color,
         debugNormal, debugDepth, debugUV, heatMapColor } from '../src/index.js';

describe('Debug rendering', () => {
  const mat = new Lambertian(new Color(0.5, 0.5, 0.5));

  it('normal map produces RGB from normal', () => {
    const rec = { normal: new Vec3(1, 0, -1).unit() };
    const c = debugNormal(rec);
    assert.ok(c.x > 0.5); // Positive x → red > 0.5
    assert.ok(Math.abs(c.y - 0.5) < 0.1); // Near-zero y → green ≈ 0.5
  });

  it('normal map: null rec returns black', () => {
    const c = debugNormal(null);
    assert.equal(c.x, 0);
  });

  it('depth map: close = bright', () => {
    const c1 = debugDepth({ t: 1 }, 20);
    const c2 = debugDepth({ t: 19 }, 20);
    assert.ok(c1.x > c2.x);
  });

  it('depth map: no hit = sky', () => {
    const c = debugDepth(null);
    assert.ok(c.z > c.x); // Sky is blueish
  });

  it('UV debug', () => {
    const c = debugUV({ u: 0.5, v: 0.75 });
    assert.ok(Math.abs(c.x - 0.5) < 1e-6);
    assert.ok(Math.abs(c.y - 0.75) < 1e-6);
  });

  it('heat map: 0 = blue, 0.5 = green, 1 = red', () => {
    const blue = heatMapColor(0);
    const green = heatMapColor(0.5);
    const red = heatMapColor(1);
    assert.ok(blue.z > blue.x);
    assert.ok(green.y > green.x && green.y > green.z);
    assert.ok(red.x > red.z);
  });
});
