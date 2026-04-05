// advanced.test.js — Tests for BVH, triangle, and transform

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from './vec3.js';
import { Ray } from './ray.js';
import { Sphere } from './sphere.js';
import { Triangle } from './triangle.js';
import { AABB } from './aabb.js';
import { BVHNode } from './bvh.js';
import { HitRecord, HittableList } from './hittable.js';

const EPSILON = 1e-4;
function approx(a, b, msg = '') {
  assert.ok(Math.abs(a - b) < EPSILON, `${msg}: ${a} ≈ ${b}`);
}

const dummyMat = { scatter: () => null };

describe('Triangle — Möller-Trumbore', () => {
  const v0 = new Vec3(0, 0, 0);
  const v1 = new Vec3(1, 0, 0);
  const v2 = new Vec3(0, 1, 0);

  it('ray hits triangle', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.t, 1.0, 't');
    approx(hit.p.z, 0, 'hit z');
  });

  it('ray misses triangle', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const ray = new Ray(new Vec3(2, 2, 1), new Vec3(0, 0, -1)); // outside
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('parallel ray misses', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(1, 0, 0)); // parallel to plane
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('back face hit', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const ray = new Ray(new Vec3(0.2, 0.2, -1), new Vec3(0, 0, 1)); // from behind
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    assert.equal(hit.frontFace, false);
  });

  it('hit at vertex', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 1), new Vec3(0, 0, -1)); // at v0
    const hit = tri.hit(ray, 0.001, Infinity);
    // Vertices are edge cases — result depends on algorithm precision
    // Just verify no crash
    if (hit) approx(hit.t, 1.0);
  });

  it('hit at edge', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const ray = new Ray(new Vec3(0.5, 0, 1), new Vec3(0, 0, -1)); // on v0-v1 edge
    const hit = tri.hit(ray, 0.001, Infinity);
    if (hit) approx(hit.t, 1.0);
  });

  it('has bounding box', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const box = tri.boundingBox();
    assert.ok(box);
    assert.ok(box.minimum.x <= 0);
    assert.ok(box.maximum.x >= 1);
    assert.ok(box.maximum.y >= 1);
  });

  it('large triangle', () => {
    const tri = new Triangle(
      new Vec3(-100, -100, 0),
      new Vec3(100, -100, 0),
      new Vec3(0, 100, 0),
      dummyMat
    );
    const ray = new Ray(new Vec3(0, 0, 5), new Vec3(0, 0, -1));
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.t, 5.0);
  });

  it('respects tMin/tMax', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat);
    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const hit = tri.hit(ray, 0.001, 0.5); // max before triangle
    assert.equal(hit, null);
  });

  it('smooth shading with vertex normals', () => {
    const tri = new Triangle(v0, v1, v2, dummyMat, {
      normals: [new Vec3(0, 0, 1), new Vec3(0, 0, 1), new Vec3(0, 0, 1)]
    });
    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const hit = tri.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.normal.z, 1, 'interpolated normal z');
  });
});

describe('BVH', () => {
  it('builds BVH from spheres', () => {
    const objects = [
      new Sphere(new Vec3(-2, 0, 0), 0.5, dummyMat),
      new Sphere(new Vec3(0, 0, 0), 0.5, dummyMat),
      new Sphere(new Vec3(2, 0, 0), 0.5, dummyMat),
    ];
    const bvh = new BVHNode(objects);
    assert.ok(bvh.box);
  });

  it('BVH hit finds correct sphere', () => {
    const objects = [
      new Sphere(new Vec3(-2, 0, -1), 0.5, dummyMat),
      new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat),
      new Sphere(new Vec3(2, 0, -1), 0.5, dummyMat),
    ];
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = bvh.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.p.x, 0, 'center sphere x');
  });

  it('BVH miss', () => {
    const objects = [
      new Sphere(new Vec3(-2, 0, -1), 0.5, dummyMat),
      new Sphere(new Vec3(2, 0, -1), 0.5, dummyMat),
    ];
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 1, 0)); // up
    const hit = bvh.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('BVH with single object', () => {
    const objects = [new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat)];
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = bvh.hit(ray, 0.001, Infinity);
    assert.ok(hit);
  });

  it('BVH with many objects', () => {
    const objects = [];
    for (let i = 0; i < 100; i++) {
      objects.push(new Sphere(
        new Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, -5),
        0.3, dummyMat
      ));
    }
    const bvh = new BVHNode(objects);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    // Just verify no crash
    bvh.hit(ray, 0.001, Infinity);
  });

  it('BVH has bounding box', () => {
    const objects = [
      new Sphere(new Vec3(-5, 0, 0), 1, dummyMat),
      new Sphere(new Vec3(5, 0, 0), 1, dummyMat),
    ];
    const bvh = new BVHNode(objects);
    const box = bvh.boundingBox();
    assert.ok(box);
    assert.ok(box.minimum.x <= -4);
    assert.ok(box.maximum.x >= 4);
  });

  it('BVH gives same results as linear list', () => {
    const objects = [
      new Sphere(new Vec3(-1, 0, -2), 0.5, dummyMat),
      new Sphere(new Vec3(0, 0, -3), 0.5, dummyMat),
      new Sphere(new Vec3(1, 0, -4), 0.5, dummyMat),
    ];
    const list = new HittableList();
    objects.forEach(o => list.add(o));

    const bvh = new BVHNode([...objects]);

    // Test several rays
    const rays = [
      new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1)),
      new Ray(new Vec3(-1, 0, 0), new Vec3(0, 0, -1)),
      new Ray(new Vec3(1, 0, 0), new Vec3(0, 0, -1)),
      new Ray(new Vec3(0, 5, 0), new Vec3(0, 0, -1)), // miss
    ];

    for (const ray of rays) {
      const listHit = list.hit(ray, 0.001, Infinity);
      const bvhHit = bvh.hit(ray, 0.001, Infinity);
      if (listHit === null) {
        assert.equal(bvhHit, null, 'Both should miss');
      } else {
        assert.ok(bvhHit, 'BVH should also hit');
        approx(listHit.t, bvhHit.t, 'Same t');
      }
    }
  });
});
