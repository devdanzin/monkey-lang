import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Point3, Color, Ray, Sphere, HittableList, Lambertian, AABB, BVHNode } from '../src/index.js';

describe('AABB', () => {
  it('ray hits box', () => {
    const box = new AABB(new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
    const ray = new Ray(new Vec3(0, 0, 5), new Vec3(0, 0, -1));
    assert.ok(box.hit(ray, 0.001, Infinity));
  });

  it('ray misses box', () => {
    const box = new AABB(new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
    const ray = new Ray(new Vec3(5, 5, 5), new Vec3(0, 0, -1));
    assert.ok(!box.hit(ray, 0.001, Infinity));
  });

  it('surrounding box', () => {
    const a = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
    const b = new AABB(new Vec3(-1, -1, -1), new Vec3(0, 0, 0));
    const c = AABB.surrounding(a, b);
    assert.equal(c.minimum.x, -1);
    assert.equal(c.maximum.x, 1);
  });
});

describe('Sphere bounding box', () => {
  it('returns correct AABB', () => {
    const s = new Sphere(new Vec3(1, 2, 3), 0.5, new Lambertian(new Vec3(1, 0, 0)));
    const box = s.boundingBox();
    assert.ok(box);
    assert.ok(Math.abs(box.minimum.x - 0.5) < 1e-6);
    assert.ok(Math.abs(box.maximum.x - 1.5) < 1e-6);
  });
});

describe('BVH', () => {
  it('hits objects through BVH', () => {
    const mat = new Lambertian(new Vec3(0.5, 0.5, 0.5));
    const objects = [
      new Sphere(new Vec3(0, 0, -1), 0.5, mat),
      new Sphere(new Vec3(2, 0, -1), 0.5, mat),
      new Sphere(new Vec3(-2, 0, -1), 0.5, mat),
    ];
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = bvh.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(Math.abs(rec.t - 0.5) < 1e-6);
  });

  it('misses when no objects in path', () => {
    const mat = new Lambertian(new Vec3(0.5, 0.5, 0.5));
    const objects = [
      new Sphere(new Vec3(5, 5, -1), 0.5, mat),
      new Sphere(new Vec3(-5, -5, -1), 0.5, mat),
    ];
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = bvh.hit(ray, 0.001, Infinity);
    assert.equal(rec, null);
  });

  it('handles many objects', () => {
    const mat = new Lambertian(new Vec3(0.5, 0.5, 0.5));
    const objects = [];
    for (let i = 0; i < 100; i++) {
      objects.push(new Sphere(
        new Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, -5 - Math.random() * 10),
        0.2, mat
      ));
    }
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    // Just verify it doesn't crash
    bvh.hit(ray, 0.001, Infinity);
  });

  it('BVH and linear search give same results', () => {
    const mat = new Lambertian(new Vec3(0.5, 0.5, 0.5));
    const objects = [];
    for (let i = 0; i < 50; i++) {
      objects.push(new Sphere(
        new Vec3(Math.random() * 10 - 5, Math.random() * 10 - 5, -2 - Math.random() * 8),
        0.3, mat
      ));
    }

    const list = new HittableList();
    objects.forEach(o => list.add(o));
    const bvh = new BVHNode([...objects]); // copy since BVH reorders

    // Test 100 random rays
    for (let i = 0; i < 100; i++) {
      const dir = new Vec3(Math.random() - 0.5, Math.random() - 0.5, -1).unit();
      const ray = new Ray(new Vec3(0, 0, 0), dir);
      const listHit = list.hit(ray, 0.001, Infinity);
      const bvhHit = bvh.hit(ray, 0.001, Infinity);

      if (listHit) {
        assert.ok(bvhHit, 'BVH missed a hit that linear found');
        assert.ok(Math.abs(listHit.t - bvhHit.t) < 1e-6, `t mismatch: ${listHit.t} vs ${bvhHit.t}`);
      } else {
        assert.equal(bvhHit, null, 'BVH found a hit that linear missed');
      }
    }
  });
});

describe('BVH performance', () => {
  it('BVH is faster than linear for many objects', () => {
    const mat = new Lambertian(new Vec3(0.5, 0.5, 0.5));
    const objects = [];
    for (let i = 0; i < 500; i++) {
      objects.push(new Sphere(
        new Vec3(Math.random() * 20 - 10, 0.2, Math.random() * 20 - 10),
        0.2, mat
      ));
    }

    const list = new HittableList();
    objects.forEach(o => list.add(o));
    const bvh = new BVHNode([...objects]);

    const rays = [];
    for (let i = 0; i < 10000; i++) {
      rays.push(new Ray(
        new Vec3(0, 5, 0),
        new Vec3(Math.random() * 20 - 10, -5, Math.random() * 20 - 10).unit()
      ));
    }

    // Time linear
    const t0 = performance.now();
    for (const ray of rays) list.hit(ray, 0.001, Infinity);
    const linearMs = performance.now() - t0;

    // Time BVH
    const t1 = performance.now();
    for (const ray of rays) bvh.hit(ray, 0.001, Infinity);
    const bvhMs = performance.now() - t1;

    const speedup = linearMs / bvhMs;
    console.log(`    BVH speedup: ${speedup.toFixed(1)}x (linear: ${linearMs.toFixed(0)}ms, BVH: ${bvhMs.toFixed(0)}ms)`);
    // BVH should be at least 2x faster for 500 objects
    assert.ok(speedup > 2, `BVH speedup only ${speedup.toFixed(1)}x`);
  });
});
