import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Ray, Sphere, Lambertian, Color, Isotropic, ConstantMedium, HittableList, Camera, Renderer } from '../src/index.js';

describe('Isotropic', () => {
  it('scatters in random direction', () => {
    const mat = new Isotropic(new Color(0.5, 0.5, 0.5));
    const rec = { p: new Vec3(0, 0, 0) };
    const result = mat.scatter(null, rec);
    assert.ok(result);
    assert.ok(result.scattered);
    assert.equal(result.attenuation.x, 0.5);
  });
});

describe('ConstantMedium', () => {
  it('can be hit probabilistically', () => {
    const boundary = new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Color(1, 1, 1)));
    const medium = new ConstantMedium(boundary, 0.5, new Color(0.5, 0.5, 0.5));
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));

    // With density 0.5, some rays should hit and some should pass through
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      if (medium.hit(ray, 0.001, Infinity)) hits++;
    }
    // Should get some hits but not all
    assert.ok(hits > 0, 'Should get some hits through the medium');
    assert.ok(hits < 100, 'Should not hit every time (probabilistic)');
  });

  it('has bounding box from boundary', () => {
    const boundary = new Sphere(new Vec3(0, 0, 0), 1, new Lambertian(new Color(1, 1, 1)));
    const medium = new ConstantMedium(boundary, 0.5, new Color(0.5, 0.5, 0.5));
    const box = medium.boundingBox();
    assert.ok(box);
  });

  it('renders in a scene', () => {
    const world = new HittableList();
    // Fog sphere
    const boundary = new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Color(1, 1, 1)));
    world.add(new ConstantMedium(boundary, 2, new Color(0.2, 0.4, 0.9)));
    // Ground
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Color(0.8, 0.8, 0.0))));

    const cam = new Camera({ lookFrom: new Vec3(0, 0, 0), lookAt: new Vec3(0, 0, -1), vfov: 90, aspectRatio: 2 });
    const renderer = new Renderer({ width: 10, height: 5, samplesPerPixel: 10, maxDepth: 20, camera: cam, world });
    const pixels = renderer.render();
    assert.equal(pixels.length, 10 * 5 * 4);
  });
});
