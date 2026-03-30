import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color, Ray, Sphere, HittableList, DiffuseLight, Lambertian, Camera, Renderer, XZRect } from '../src/index.js';

describe('DiffuseLight', () => {
  it('does not scatter', () => {
    const light = new DiffuseLight(new Color(4, 4, 4));
    const result = light.scatter(null, {});
    assert.equal(result, null);
  });

  it('emits color', () => {
    const light = new DiffuseLight(new Color(4, 4, 4));
    const c = light.emitted(0, 0, new Vec3(0, 0, 0));
    assert.equal(c.x, 4);
  });

  it('light illuminates scene', () => {
    const world = new HittableList();
    // Floor
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Color(0.8, 0.8, 0.8))));
    // Light above
    world.add(new XZRect(-1, 1, -2, 0, 3, new DiffuseLight(new Color(4, 4, 4))));

    const cam = new Camera({
      lookFrom: new Vec3(0, 1, 2),
      lookAt: new Vec3(0, 0, -1),
      vfov: 60,
      aspectRatio: 2
    });

    const renderer = new Renderer({
      width: 10, height: 5,
      samplesPerPixel: 20,
      maxDepth: 10,
      camera: cam, world,
      background: new Color(0, 0, 0) // Dark background to see the light
    });

    const pixels = renderer.render();
    // Some pixels should be lit (not all black)
    let hasLight = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) {
        hasLight = true;
        break;
      }
    }
    assert.ok(hasLight, 'Scene should have some illuminated pixels from area light');
  });
});
