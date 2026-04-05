// color-lighting.test.js — Color math and lighting tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from './vec3.js';

describe('Color and Lighting Math', () => {
  it('color addition', () => {
    const c1 = new Vec3(0.5, 0.3, 0.1);
    const c2 = new Vec3(0.2, 0.4, 0.6);
    const sum = c1.add(c2);
    assert.ok(Math.abs(sum.x - 0.7) < 0.001);
    assert.ok(Math.abs(sum.y - 0.7) < 0.001);
    assert.ok(Math.abs(sum.z - 0.7) < 0.001);
  });

  it('color multiplication (modulation)', () => {
    const c1 = new Vec3(0.5, 0.8, 1.0);
    const c2 = new Vec3(0.4, 0.5, 0.6);
    const prod = new Vec3(c1.x * c2.x, c1.y * c2.y, c1.z * c2.z);
    assert.ok(Math.abs(prod.x - 0.2) < 0.001);
  });

  it('color clamping', () => {
    const c = new Vec3(1.5, -0.3, 0.5);
    const clamped = new Vec3(
      Math.max(0, Math.min(1, c.x)),
      Math.max(0, Math.min(1, c.y)),
      Math.max(0, Math.min(1, c.z))
    );
    assert.equal(clamped.x, 1);
    assert.equal(clamped.y, 0);
    assert.equal(clamped.z, 0.5);
  });

  it('diffuse shading — dot product with normal', () => {
    const normal = new Vec3(0, 1, 0);
    const light = new Vec3(0, 1, 0).unit();
    const intensity = Math.max(0, normal.dot(light));
    assert.ok(Math.abs(intensity - 1.0) < 0.001);
  });

  it('diffuse at 45 degrees', () => {
    const normal = new Vec3(0, 1, 0);
    const light = new Vec3(1, 1, 0).unit();
    const intensity = Math.max(0, normal.dot(light));
    assert.ok(Math.abs(intensity - 0.7071) < 0.01);
  });

  it('diffuse at 90 degrees — no light', () => {
    const normal = new Vec3(0, 1, 0);
    const light = new Vec3(1, 0, 0); // perpendicular
    const intensity = Math.max(0, normal.dot(light));
    assert.ok(Math.abs(intensity) < 0.001);
  });

  it('reflection vector', () => {
    const incoming = new Vec3(1, -1, 0).unit();
    const normal = new Vec3(0, 1, 0);
    const reflected = incoming.reflect(normal);
    assert.ok(reflected.y > 0); // reflected upward
  });

  it('Schlick approximation at normal incidence', () => {
    const cosTheta = 1.0;
    const r0 = 0.04; // glass-like
    const reflectance = r0 + (1 - r0) * Math.pow(1 - cosTheta, 5);
    assert.ok(Math.abs(reflectance - r0) < 0.001);
  });

  it('Schlick at grazing angle', () => {
    const cosTheta = 0.0;
    const r0 = 0.04;
    const reflectance = r0 + (1 - r0) * Math.pow(1 - cosTheta, 5);
    assert.ok(Math.abs(reflectance - 1.0) < 0.001);
  });

  it('gamma correction', () => {
    const linear = 0.5;
    const gamma = Math.pow(linear, 1 / 2.2);
    assert.ok(gamma > linear); // gamma correction brightens midtones
    assert.ok(gamma < 1.0);
  });
});
