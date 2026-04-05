// milestone-110.test.js — Push ray-tracer to 110 tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color } from './vec3.js';
import { Ray } from './ray.js';
import { Sphere } from './sphere.js';
import { HittableList } from './hittable.js';
import { Lambertian } from './material.js';
import { BVHNode } from './bvh.js';

const mat = new Lambertian(new Color(0.5, 0.5, 0.5));

describe('🎯 Ray-Tracer 110 Tests', () => {
  it('sphere at different distances', () => {
    for (const d of [1, 5, 10, 100]) {
      const sphere = new Sphere(new Vec3(0, 0, -d), 0.5, mat);
      const ray = new Ray(Vec3.zero(), new Vec3(0, 0, -1));
      const hit = sphere.hit(ray, 0.001, Infinity);
      assert.ok(hit, `Should hit sphere at distance ${d}`);
      assert.ok(Math.abs(hit.t - (d - 0.5)) < 0.01, `t should be ${d - 0.5}, got ${hit.t}`);
    }
  });

  it('many spheres in BVH', () => {
    const objects = [];
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 0; z++) {
        objects.push(new Sphere(new Vec3(x, 0, z), 0.3, mat));
      }
    }
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 1, 1), new Vec3(0, -0.5, -1).unit());
    const hit = bvh.hit(ray, 0.001, Infinity);
    // Should hit one of the spheres
    assert.ok(hit);
  });

  it('ray from inside large sphere', () => {
    const sphere = new Sphere(Vec3.zero(), 1000, mat);
    const ray = new Ray(Vec3.zero(), new Vec3(1, 0, 0));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    assert.ok(hit.t > 0);
    assert.equal(hit.frontFace, false); // inside sphere
  });

  it('perpendicular ray misses all spheres', () => {
    const list = new HittableList();
    for (let i = 0; i < 10; i++) {
      list.add(new Sphere(new Vec3(i, 0, -1), 0.3, mat));
    }
    // Ray going straight up from (-100, 0, 0)
    const ray = new Ray(new Vec3(-100, 0, 0), new Vec3(0, 1, 0));
    assert.equal(list.hit(ray, 0.001, Infinity), null);
  });

  it('multiple hits returns nearest', () => {
    const list = new HittableList();
    list.add(new Sphere(new Vec3(0, 0, -1), 0.3, mat));
    list.add(new Sphere(new Vec3(0, 0, -2), 0.3, mat));
    list.add(new Sphere(new Vec3(0, 0, -3), 0.3, mat));
    const ray = new Ray(Vec3.zero(), new Vec3(0, 0, -1));
    const hit = list.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    assert.ok(hit.t < 1.5, `Should hit nearest sphere, t=${hit.t}`);
  });

  it('BVH bounding box contains all objects', () => {
    const objects = [
      new Sphere(new Vec3(-10, 0, 0), 1, mat),
      new Sphere(new Vec3(10, 0, 0), 1, mat),
      new Sphere(new Vec3(0, 10, 0), 1, mat),
    ];
    const bvh = new BVHNode(objects);
    const box = bvh.boundingBox();
    assert.ok(box.minimum.x <= -9);
    assert.ok(box.maximum.x >= 9);
    assert.ok(box.maximum.y >= 9);
  });

  it('Vec3 operations are commutative where expected', () => {
    const a = new Vec3(1, 2, 3);
    const b = new Vec3(4, 5, 6);
    assert.equal(a.dot(b), b.dot(a)); // dot is commutative
    // Addition is commutative
    const sum1 = a.add(b);
    const sum2 = b.add(a);
    assert.equal(sum1.x, sum2.x);
    assert.equal(sum1.y, sum2.y);
    assert.equal(sum1.z, sum2.z);
  });
});
