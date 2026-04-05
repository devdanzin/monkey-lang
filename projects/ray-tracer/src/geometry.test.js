// geometry.test.js — Tests for sphere, plane, AABB intersection

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from './vec3.js';
import { Ray } from './ray.js';
import { Sphere } from './sphere.js';
import { AABB } from './aabb.js';
import { HitRecord, HittableList } from './hittable.js';

const EPSILON = 1e-6;
function approx(a, b, msg = '') {
  assert.ok(Math.abs(a - b) < EPSILON, `${msg}: ${a} ≈ ${b}`);
}

// Dummy material for testing
const dummyMat = { scatter: () => null };

describe('Sphere — Ray Intersection', () => {
  it('ray hits sphere from outside', () => {
    const sphere = new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.t, 0.5, 't');
    approx(hit.p.z, -0.5, 'hit point z');
  });

  it('ray misses sphere', () => {
    const sphere = new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 1, 0)); // up
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('ray inside sphere hits far side', () => {
    const sphere = new Sphere(new Vec3(0, 0, 0), 10, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, 1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.t, 10, 't');
    assert.equal(hit.frontFace, false); // inside sphere
  });

  it('sphere behind ray returns null', () => {
    const sphere = new Sphere(new Vec3(0, 0, 1), 0.5, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1)); // away from sphere
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('normal points outward', () => {
    const sphere = new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit.frontFace);
    approx(hit.normal.z, 1, 'normal z'); // pointing back at camera
  });

  it('respects tMin/tMax', () => {
    const sphere = new Sphere(new Vec3(0, 0, -2), 0.5, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, 1.0); // max before sphere
    assert.equal(hit, null);
  });

  it('unit sphere at origin', () => {
    const sphere = new Sphere(new Vec3(0, 0, 0), 1.0, dummyMat);
    const ray = new Ray(new Vec3(0, 0, 5), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.t, 4.0, 't');
    approx(hit.p.z, 1.0, 'hit point z');
  });

  it('tangent ray misses (barely)', () => {
    const sphere = new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat);
    // Ray just above the sphere
    const ray = new Ray(new Vec3(0, 0.51, 0), new Vec3(0, 0, -1));
    const hit = sphere.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });
});

describe('Sphere — Bounding Box', () => {
  it('returns AABB', () => {
    const sphere = new Sphere(new Vec3(1, 2, 3), 0.5, dummyMat);
    const box = sphere.boundingBox();
    approx(box.minimum.x, 0.5);
    approx(box.maximum.x, 1.5);
    approx(box.minimum.y, 1.5);
    approx(box.maximum.y, 2.5);
  });
});

describe('AABB — Ray Intersection', () => {
  it('ray hits box', () => {
    const box = new AABB(new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
    const ray = new Ray(new Vec3(0, 0, 5), new Vec3(0, 0, -1));
    assert.ok(box.hit(ray, 0.001, Infinity));
  });

  it('ray misses box', () => {
    const box = new AABB(new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
    const ray = new Ray(new Vec3(0, 5, 5), new Vec3(0, 0, -1)); // above
    assert.ok(!box.hit(ray, 0.001, Infinity));
  });

  it('ray inside box hits', () => {
    const box = new AABB(new Vec3(-10, -10, -10), new Vec3(10, 10, 10));
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(1, 0, 0));
    assert.ok(box.hit(ray, 0.001, Infinity));
  });

  it('box behind ray misses', () => {
    const box = new AABB(new Vec3(-1, -1, 3), new Vec3(1, 1, 5));
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    assert.ok(!box.hit(ray, 0.001, Infinity));
  });

  it('degenerate box (flat)', () => {
    const box = new AABB(new Vec3(-1, 0, -1), new Vec3(1, 0, 1));
    // Flat box, ray perpendicular
    const ray = new Ray(new Vec3(0, 1, 0), new Vec3(0, -1, 0));
    // This depends on implementation — may or may not hit
    // Just verify no crash
    box.hit(ray, 0.001, Infinity);
  });

  it('surrounding box', () => {
    const a = new AABB(new Vec3(-1, -1, -1), new Vec3(0, 0, 0));
    const b = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
    const c = AABB.surrounding(a, b);
    approx(c.minimum.x, -1);
    approx(c.maximum.x, 1);
  });
});

describe('HitRecord', () => {
  it('setFaceNormal — front face', () => {
    const rec = new HitRecord();
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const outwardNormal = new Vec3(0, 0, 1); // facing camera
    rec.setFaceNormal(ray, outwardNormal);
    assert.equal(rec.frontFace, true);
    approx(rec.normal.z, 1);
  });

  it('setFaceNormal — back face', () => {
    const rec = new HitRecord();
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, 1));
    const outwardNormal = new Vec3(0, 0, 1); // same direction as ray
    rec.setFaceNormal(ray, outwardNormal);
    assert.equal(rec.frontFace, false);
    approx(rec.normal.z, -1); // flipped
  });
});

describe('HittableList', () => {
  it('empty list returns null', () => {
    const list = new HittableList();
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = list.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });

  it('hits nearest of multiple objects', () => {
    const list = new HittableList();
    list.add(new Sphere(new Vec3(0, 0, -2), 0.5, dummyMat)); // far
    list.add(new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat)); // near
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = list.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    approx(hit.t, 0.5, 'nearest sphere');
  });

  it('returns null when all objects missed', () => {
    const list = new HittableList();
    list.add(new Sphere(new Vec3(10, 10, 10), 0.5, dummyMat));
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = list.hit(ray, 0.001, Infinity);
    assert.equal(hit, null);
  });
});
