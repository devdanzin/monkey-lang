import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Ray, MovingSphere, Lambertian, Color, HittableList, Camera, Renderer } from '../src/index.js';

describe('MovingSphere', () => {
  const mat = new Lambertian(new Color(0.5, 0.5, 0.5));

  it('center interpolates over time', () => {
    const ms = new MovingSphere(new Vec3(0, 0, 0), new Vec3(10, 0, 0), 0, 1, 0.5, mat);
    const c0 = ms.center(0);
    const c1 = ms.center(1);
    const cMid = ms.center(0.5);
    assert.equal(c0.x, 0);
    assert.equal(c1.x, 10);
    assert.equal(cMid.x, 5);
  });

  it('ray hits at specific time', () => {
    const ms = new MovingSphere(new Vec3(0, 0, -1), new Vec3(10, 0, -1), 0, 1, 0.5, mat);
    // At time 0, sphere is at (0,0,-1)
    const ray0 = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1), 0);
    assert.ok(ms.hit(ray0, 0.001, Infinity));

    // At time 1, sphere has moved to (10,0,-1)
    const ray1 = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1), 1);
    assert.equal(ms.hit(ray1, 0.001, Infinity), null); // Should miss at origin
  });

  it('has bounding box covering full motion', () => {
    const ms = new MovingSphere(new Vec3(0, 0, 0), new Vec3(10, 0, 0), 0, 1, 0.5, mat);
    const box = ms.boundingBox();
    assert.ok(box);
    assert.ok(box.minimum.x < 0); // Covers start
    assert.ok(box.maximum.x > 10); // Covers end
  });

  it('renders motion blur', () => {
    const world = new HittableList();
    world.add(new MovingSphere(new Vec3(0, 0, -1), new Vec3(0, 1, -1), 0, 1, 0.5, mat));

    const cam = new Camera({
      lookFrom: new Vec3(0, 0, 0), lookAt: new Vec3(0, 0, -1),
      vfov: 90, aspectRatio: 2, time0: 0, time1: 1
    });

    const renderer = new Renderer({ width: 10, height: 5, samplesPerPixel: 4, maxDepth: 10, camera: cam, world });
    const pixels = renderer.render();
    assert.equal(pixels.length, 10 * 5 * 4);
  });
});
