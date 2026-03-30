import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Ray, Triangle, Mesh, Lambertian, Color } from '../src/index.js';

describe('Triangle', () => {
  const mat = new Lambertian(new Color(0.5, 0.5, 0.5));

  it('ray hits triangle', () => {
    const tri = new Triangle(
      new Vec3(-1, 0, -1), new Vec3(1, 0, -1), new Vec3(0, 2, -1), mat
    );
    const ray = new Ray(new Vec3(0, 0.5, 0), new Vec3(0, 0, -1));
    const rec = tri.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(Math.abs(rec.t - 1) < 1e-6);
  });

  it('ray misses triangle', () => {
    const tri = new Triangle(
      new Vec3(-1, 0, -1), new Vec3(1, 0, -1), new Vec3(0, 2, -1), mat
    );
    const ray = new Ray(new Vec3(5, 5, 0), new Vec3(0, 0, -1));
    assert.equal(tri.hit(ray, 0.001, Infinity), null);
  });

  it('has bounding box', () => {
    const tri = new Triangle(
      new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0), mat
    );
    const box = tri.boundingBox();
    assert.ok(box);
  });

  it('front face detection', () => {
    const tri = new Triangle(
      new Vec3(-1, 0, -1), new Vec3(1, 0, -1), new Vec3(0, 2, -1), mat
    );
    const ray = new Ray(new Vec3(0, 0.5, 0), new Vec3(0, 0, -1));
    const rec = tri.hit(ray, 0.001, Infinity);
    assert.ok(rec.frontFace);
  });
});

describe('Mesh', () => {
  const mat = new Lambertian(new Color(0.5, 0.5, 0.5));

  it('OBJ parser: triangle', () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const mesh = Mesh.fromOBJ(obj, mat);
    assert.equal(mesh.triangles.length, 1);
  });

  it('OBJ parser: quad (triangulated)', () => {
    const obj = `
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3 4
`;
    const mesh = Mesh.fromOBJ(obj, mat);
    assert.equal(mesh.triangles.length, 2);
  });

  it('OBJ parser: cube', () => {
    const obj = `
v -1 -1 -1
v  1 -1 -1
v  1  1 -1
v -1  1 -1
v -1 -1  1
v  1 -1  1
v  1  1  1
v -1  1  1
f 1 2 3 4
f 5 6 7 8
f 1 2 6 5
f 3 4 8 7
f 1 4 8 5
f 2 3 7 6
`;
    const mesh = Mesh.fromOBJ(obj, mat);
    assert.equal(mesh.triangles.length, 12);

    // Ray should hit the cube
    const ray = new Ray(new Vec3(0, 0, 5), new Vec3(0, 0, -1));
    const rec = mesh.hit(ray, 0.001, Infinity);
    assert.ok(rec);
  });

  it('has bounding box', () => {
    const tris = [
      new Triangle(new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0), mat),
      new Triangle(new Vec3(1, 0, 0), new Vec3(1, 1, 0), new Vec3(0, 1, 0), mat),
    ];
    const mesh = new Mesh(tris);
    assert.ok(mesh.boundingBox());
  });
});
