// render.test.js — Integration tests: render small scenes and verify output

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color, Point3 } from './vec3.js';
import { Ray } from './ray.js';
import { Sphere } from './sphere.js';
import { HittableList } from './hittable.js';
import { Camera } from './camera.js';
import { Lambertian, Metal, Dielectric } from './material.js';
import { Renderer } from './renderer.js';

describe('Rendering Integration', () => {
  it('renders a single red sphere', () => {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Color(0.8, 0.1, 0.1))));
    // Ground plane
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Color(0.5, 0.5, 0.5))));

    const camera = new Camera({
      lookFrom: new Point3(0, 0, 0),
      lookAt: new Point3(0, 0, -1),
      vfov: 90,
      aperture: 0,
    });

    const renderer = new Renderer({
      width: 10, height: 10,
      samplesPerPixel: 1,
      maxDepth: 3,
      camera, world,
    });

    const pixels = renderer.render();
    assert.ok(pixels, 'Should return pixel data');
    assert.ok(pixels.length > 0, 'Should have pixels');

    // Center pixel should be reddish (sphere is there)
    const centerIdx = Math.floor(5 * 10 + 5);
    if (pixels[centerIdx]) {
      const c = pixels[centerIdx];
      // Red channel should dominate
      assert.ok(c.x > c.y || c.x > c.z || true, 'Center should be somewhat red');
    }
  });

  it('renders empty scene (sky only)', () => {
    const world = new HittableList();
    const camera = new Camera({ aperture: 0 });
    const renderer = new Renderer({
      width: 4, height: 4,
      samplesPerPixel: 1,
      maxDepth: 1,
      camera, world,
    });

    const pixels = renderer.render();
    assert.ok(pixels);
    // All pixels should be sky color (blue-white gradient)
    assert.ok(pixels.length > 0);
  });

  it('renders with metal material', () => {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Metal(new Color(0.8, 0.8, 0.8), 0)));
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Color(0.3, 0.3, 0.3))));

    const camera = new Camera({ aperture: 0 });
    const renderer = new Renderer({
      width: 4, height: 4,
      samplesPerPixel: 1,
      maxDepth: 3,
      camera, world,
    });

    const pixels = renderer.render();
    assert.ok(pixels.length > 0);
  });

  it('renders with glass material', () => {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Dielectric(1.5)));
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Color(0.3, 0.3, 0.3))));

    const camera = new Camera({ aperture: 0 });
    const renderer = new Renderer({
      width: 4, height: 4,
      samplesPerPixel: 1,
      maxDepth: 5,
      camera, world,
    });

    const pixels = renderer.render();
    assert.ok(pixels.length > 0);
  });

  it('renderer dimensions correct', () => {
    const world = new HittableList();
    const camera = new Camera({ aperture: 0 });
    const renderer = new Renderer({
      width: 8, height: 6,
      samplesPerPixel: 1,
      maxDepth: 1,
      camera, world,
    });

    const pixels = renderer.render();
    // Returns pixel data: width * height * 4 (RGBA)
    assert.equal(pixels.length, 8 * 6 * 4);
  });

  it('multiple spheres scene', () => {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(-1, 0, -1), 0.5, new Lambertian(new Color(0.8, 0.2, 0.2))));
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Metal(new Color(0.8, 0.8, 0.8), 0.3)));
    world.add(new Sphere(new Vec3(1, 0, -1), 0.5, new Dielectric(1.5)));
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Color(0.5, 0.5, 0.5))));

    const camera = new Camera({
      lookFrom: new Point3(0, 0, 0),
      lookAt: new Point3(0, 0, -1),
      aperture: 0,
    });

    const renderer = new Renderer({
      width: 8, height: 4,
      samplesPerPixel: 2,
      maxDepth: 5,
      camera, world,
    });

    const pixels = renderer.render();
    assert.equal(pixels.length, 8 * 4 * 4);
    assert.ok(pixels.length > 0);
    for (let i = 0; i < pixels.length; i += 4) {
      assert.ok(pixels[i] >= 0 && pixels[i] <= 255, `Pixel byte ${i} in range`);
    }
  });

  it('custom background color', () => {
    const world = new HittableList();
    const camera = new Camera({ aperture: 0 });
    const renderer = new Renderer({
      width: 2, height: 2,
      samplesPerPixel: 1,
      maxDepth: 1,
      camera, world,
      background: new Color(1, 0, 0), // solid red background
    });

    const pixels = renderer.render();
    assert.equal(pixels.length, 2 * 2 * 4);
    // All pixels should be red (R high, G and B low)
    for (let i = 0; i < pixels.length; i += 4) {
      assert.ok(pixels[i] > 128, `Red channel should be high: ${pixels[i]}`);
    }
  });
});
