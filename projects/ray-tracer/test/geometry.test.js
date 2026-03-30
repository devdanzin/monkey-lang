import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Point3, Color, Ray, Plane, XYRect, XZRect, YZRect, Box, Lambertian } from '../src/index.js';

describe('Plane', () => {
  it('ray hits plane', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const plane = new Plane(new Vec3(0, 0, 0), new Vec3(0, 1, 0), mat);
    const ray = new Ray(new Vec3(0, 1, 0), new Vec3(0, -1, 0));
    const rec = plane.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(Math.abs(rec.t - 1) < 1e-6);
  });

  it('parallel ray misses', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const plane = new Plane(new Vec3(0, 0, 0), new Vec3(0, 1, 0), mat);
    const ray = new Ray(new Vec3(0, 1, 0), new Vec3(1, 0, 0)); // parallel
    assert.equal(plane.hit(ray, 0.001, Infinity), null);
  });

  it('has no bounding box', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const plane = new Plane(new Vec3(0, 0, 0), new Vec3(0, 1, 0), mat);
    assert.equal(plane.boundingBox(), null);
  });
});

describe('XZRect', () => {
  it('ray hits rect', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const rect = new XZRect(-1, 1, -1, 1, 0, mat);
    const ray = new Ray(new Vec3(0, 1, 0), new Vec3(0, -1, 0));
    const rec = rect.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(Math.abs(rec.t - 1) < 1e-6);
  });

  it('ray misses rect (outside bounds)', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const rect = new XZRect(-1, 1, -1, 1, 0, mat);
    const ray = new Ray(new Vec3(5, 1, 0), new Vec3(0, -1, 0));
    assert.equal(rect.hit(ray, 0.001, Infinity), null);
  });

  it('has bounding box', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const rect = new XZRect(-1, 1, -1, 1, 0, mat);
    const box = rect.boundingBox();
    assert.ok(box);
    assert.equal(box.minimum.x, -1);
    assert.equal(box.maximum.x, 1);
  });
});

describe('Box', () => {
  it('ray hits box from outside', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const box = new Box(new Vec3(-1, -1, -1), new Vec3(1, 1, 1), mat);
    const ray = new Ray(new Vec3(0, 0, 5), new Vec3(0, 0, -1));
    const rec = box.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(Math.abs(rec.t - 4) < 1e-3);
  });

  it('ray misses box', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const box = new Box(new Vec3(-1, -1, -1), new Vec3(1, 1, 1), mat);
    const ray = new Ray(new Vec3(5, 5, 5), new Vec3(0, 0, -1));
    assert.equal(box.hit(ray, 0.001, Infinity), null);
  });

  it('has bounding box', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const box = new Box(new Vec3(-1, -1, -1), new Vec3(1, 1, 1), mat);
    const aabb = box.boundingBox();
    assert.ok(aabb);
    assert.equal(aabb.minimum.x, -1);
    assert.equal(aabb.maximum.x, 1);
  });
});
