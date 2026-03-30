import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Ray, Disk, Cylinder, Cone, Lambertian, Color } from '../src/index.js';

const mat = new Lambertian(new Color(0.5, 0.5, 0.5));

describe('Disk', () => {
  it('ray hits disk', () => {
    const disk = new Disk(new Vec3(0, 0, 0), new Vec3(0, 1, 0), 1, mat);
    const ray = new Ray(new Vec3(0, 1, 0), new Vec3(0, -1, 0));
    const rec = disk.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(Math.abs(rec.t - 1) < 1e-6);
  });

  it('ray misses disk (outside radius)', () => {
    const disk = new Disk(new Vec3(0, 0, 0), new Vec3(0, 1, 0), 0.5, mat);
    const ray = new Ray(new Vec3(2, 1, 0), new Vec3(0, -1, 0));
    assert.equal(disk.hit(ray, 0.001, Infinity), null);
  });

  it('has bounding box', () => {
    const disk = new Disk(new Vec3(0, 0, 0), new Vec3(0, 1, 0), 1, mat);
    assert.ok(disk.boundingBox());
  });
});

describe('Cylinder', () => {
  it('ray hits cylinder', () => {
    const cyl = new Cylinder(new Vec3(0, 0, 0), 0.5, -1, 1, mat);
    const ray = new Ray(new Vec3(2, 0, 0), new Vec3(-1, 0, 0));
    const rec = cyl.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(Math.abs(rec.p.x - 0.5) < 1e-3);
  });

  it('ray misses above cylinder', () => {
    const cyl = new Cylinder(new Vec3(0, 0, 0), 0.5, -1, 1, mat);
    const ray = new Ray(new Vec3(2, 5, 0), new Vec3(-1, 0, 0));
    assert.equal(cyl.hit(ray, 0.001, Infinity), null);
  });

  it('has bounding box', () => {
    const cyl = new Cylinder(new Vec3(0, 0, 0), 0.5, -1, 1, mat);
    const box = cyl.boundingBox();
    assert.ok(box);
    assert.ok(Math.abs(box.minimum.y - (-1)) < 1e-6);
  });
});

describe('Cone', () => {
  it('ray hits cone', () => {
    const cone = new Cone(new Vec3(0, 1, 0), 0.5, 1, mat);
    const ray = new Ray(new Vec3(2, 0.5, 0), new Vec3(-1, 0, 0));
    const rec = cone.hit(ray, 0.001, Infinity);
    assert.ok(rec);
  });

  it('has bounding box', () => {
    const cone = new Cone(new Vec3(0, 1, 0), 0.5, 1, mat);
    const box = cone.boundingBox();
    assert.ok(box);
    assert.ok(Math.abs(box.maximum.y - 1) < 1e-6);
  });
});
