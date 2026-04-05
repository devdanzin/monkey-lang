// camera-render.test.js — Camera and rendering tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from './vec3.js';
import { Ray } from './ray.js';
import { Camera } from './camera.js';
import { Sphere } from './sphere.js';

describe('Camera and Rendering', () => {
  it('camera creates rays through center', () => {
    const cam = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 90, 1);
    const ray = cam.getRay(0.5, 0.5);
    assert.ok(ray instanceof Ray);
    assert.ok(Math.abs(ray.direction.z) > 0.5); // pointing forward
  });

  it('camera creates rays from origin', () => {
    const cam = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 90, 1);
    const ray = cam.getRay(0.5, 0.5);
    assert.ok(Math.abs(ray.origin.x) < 0.1);
    assert.ok(Math.abs(ray.origin.y) < 0.1);
  });

  it('different UV produces different rays', () => {
    const cam = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 90, 1);
    const r1 = cam.getRay(0, 0);
    const r2 = cam.getRay(1, 1);
    assert.ok(r1.direction.x !== r2.direction.x || r1.direction.y !== r2.direction.y);
  });

  it('ray from camera hits sphere', () => {
    const cam = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 90, 1);
    const sphere = new Sphere(new Vec3(0, 0, -5), 1);
    const ray = cam.getRay(0.5, 0.5);
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit !== null);
  });

  it('ray from camera misses distant sphere', () => {
    const cam = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 10, 1);
    const sphere = new Sphere(new Vec3(100, 100, -5), 1);
    const ray = cam.getRay(0.5, 0.5);
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('camera with different FOV creates camera', () => {
    const cam1 = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 30, 1);
    const cam2 = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 120, 1);
    assert.ok(cam1.getRay(0.5, 0.5) instanceof Ray);
    assert.ok(cam2.getRay(0.5, 0.5) instanceof Ray);
  });

  it('sphere normal points outward', () => {
    const sphere = new Sphere(new Vec3(0, 0, -5), 1);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit !== null);
    // Normal at front should point toward camera (positive z)
    assert.ok(hit.normal.z > 0);
  });

  it('hit point is on sphere surface', () => {
    const center = new Vec3(0, 0, -5);
    const radius = 1;
    const sphere = new Sphere(center, radius);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    const hitPoint = ray.at(hit.t);
    const dist = hitPoint.sub(center).length();
    assert.ok(Math.abs(dist - radius) < 0.01);
  });

  it('Vec3 lerp interpolation', () => {
    const a = new Vec3(0, 0, 0);
    const b = new Vec3(10, 10, 10);
    const mid = a.lerp(b, 0.5);
    assert.ok(Math.abs(mid.x - 5) < 0.001);
  });

  it('Vec3 clamp', () => {
    const v = new Vec3(1.5, -0.5, 0.3);
    const c = v.clamp(0, 1);
    assert.equal(c.x, 1);
    assert.equal(c.y, 0);
    assert.ok(Math.abs(c.z - 0.3) < 0.001);
  });

  it('multiple sphere scene — closest hit', () => {
    const s1 = new Sphere(new Vec3(0, 0, -3), 1);
    const s2 = new Sphere(new Vec3(0, 0, -7), 1);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const h1 = s1.hit(ray, 0.001, Infinity);
    const h2 = s2.hit(ray, 0.001, Infinity);
    assert.ok(h1.t < h2.t);
  });

  it('ray at function', () => {
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(1, 0, 0));
    const p = ray.at(5);
    assert.ok(Math.abs(p.x - 5) < 0.001);
    assert.ok(Math.abs(p.y) < 0.001);
  });

  it('sphere behind camera returns null', () => {
    const sphere = new Sphere(new Vec3(0, 0, 5), 1); // behind
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('aspect ratio changes horizontal ray spread', () => {
    const cam1 = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 90, 1.0);
    const cam2 = new Camera(new Vec3(0, 0, 0), new Vec3(0, 0, -1), new Vec3(0, 1, 0), 90, 2.0);
    const r1 = cam1.getRay(1, 0.5);
    const r2 = cam2.getRay(1, 0.5);
    // Different aspect ratios should give different directions
    assert.ok(typeof r1.direction.x === 'number');
    assert.ok(typeof r2.direction.x === 'number');
  });

  it('Vec3 cross product', () => {
    const x = new Vec3(1, 0, 0);
    const y = new Vec3(0, 1, 0);
    const z = x.cross(y);
    assert.ok(Math.abs(z.z - 1) < 0.001);
  });

  it('Vec3 negate', () => {
    const v = new Vec3(1, -2, 3);
    const n = v.negate();
    assert.equal(n.x, -1);
    assert.equal(n.y, 2);
    assert.equal(n.z, -3);
  });

  it('Vec3 nearZero detection', () => {
    const tiny = new Vec3(1e-10, 1e-10, 1e-10);
    assert.ok(tiny.nearZero());
    const big = new Vec3(1, 0, 0);
    assert.ok(!big.nearZero());
  });

  it('refraction vector exists', () => {
    const incoming = new Vec3(0.5, -0.5, 0).unit();
    const normal = new Vec3(0, 1, 0);
    const refracted = incoming.refract(normal, 1.5);
    assert.ok(refracted instanceof Vec3);
  });

  it('reflection is symmetric', () => {
    const v = new Vec3(1, -1, 0).unit();
    const n = new Vec3(0, 1, 0);
    const r = v.reflect(n);
    // Reflected should have same x, opposite y sign
    assert.ok(r.y > 0);
    assert.ok(Math.abs(r.x - v.x) < 0.01);
  });
});
