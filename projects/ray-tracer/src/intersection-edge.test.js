// intersection-edge.test.js — Edge cases for ray-object intersection
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from './vec3.js';
import { Ray } from './ray.js';
import { Sphere } from './sphere.js';
import { Triangle } from './triangle.js';
import { AABB } from './aabb.js';

describe('Intersection Edge Cases', () => {
  it('ray tangent to sphere', () => {
    const sphere = new Sphere(new Vec3(0, 0, -5), 1);
    // Ray barely touches top of sphere
    const ray = new Ray(new Vec3(0, 1, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    // Tangent hit: either hits at one point or misses by epsilon
    // Both are acceptable behaviors
    assert.ok(hit === null || hit.t > 0);
  });

  it('ray inside sphere hits front face', () => {
    const sphere = new Sphere(new Vec3(0, 0, 0), 10);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit !== null);
    assert.ok(hit.t > 0);
  });

  it('ray parallel to triangle misses', () => {
    const tri = new Triangle(
      new Vec3(0, 0, 0),
      new Vec3(1, 0, 0),
      new Vec3(0, 1, 0)
    );
    const ray = new Ray(new Vec3(0, 0, 1), new Vec3(1, 0, 0)); // parallel to XY plane
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('ray hits triangle from behind returns null', () => {
    const tri = new Triangle(
      new Vec3(-1, -1, -5),
      new Vec3(1, -1, -5),
      new Vec3(0, 1, -5)
    );
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, 1)); // pointing away
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('AABB ray miss', () => {
    const box = new AABB(new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
    const ray = new Ray(new Vec3(5, 5, 0), new Vec3(0, 0, -1)); // way off to side
    assert.equal(box.hit(ray, 0.001, Infinity), false);
  });

  it('AABB ray hit through center', () => {
    const box = new AABB(new Vec3(-1, -1, -6), new Vec3(1, 1, -4));
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    assert.equal(box.hit(ray, 0.001, Infinity), true);
  });

  it('sphere at various distances', () => {
    const sphere = new Sphere(new Vec3(0, 0, -10), 1);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit !== null);
    assert.ok(Math.abs(hit.t - 9) < 0.1); // sphere surface at z=-9
  });

  it('very small sphere', () => {
    const sphere = new Sphere(new Vec3(0, 0, -1), 0.001);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.0001, Infinity);
    assert.ok(hit !== null);
  });

  it('triangle normal is perpendicular to edges', () => {
    const tri = new Triangle(
      new Vec3(0, 0, 0),
      new Vec3(1, 0, 0),
      new Vec3(0, 1, 0)
    );
    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.ok(hit !== null);
    // Normal should point in +z direction
    assert.ok(Math.abs(hit.normal.z) > 0.9);
  });

  it('multiple spheres — closest hit wins', () => {
    const near = new Sphere(new Vec3(0, 0, -3), 1);
    const far = new Sphere(new Vec3(0, 0, -10), 1);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const h1 = near.hit(ray, 0.001, Infinity);
    const h2 = far.hit(ray, 0.001, Infinity);
    assert.ok(h1.t < h2.t);
  });
});
