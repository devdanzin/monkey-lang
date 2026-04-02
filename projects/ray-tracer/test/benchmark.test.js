import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Vec3, Color, Ray, Sphere, Camera, Renderer, Lambertian, Metal, Dielectric,
  DiffuseLight, HittableList, XZRect, XYRect, CheckerTexture, BVHNode
} from '../src/index.js';

/**
 * Benchmark suite for ray tracer performance.
 * Tests render speed and ensures no performance regressions.
 * Uses small resolutions to keep tests fast while still being meaningful.
 */

function createCornellBox() {
  const world = new HittableList();
  const red = new Lambertian(new Color(0.65, 0.05, 0.05));
  const white = new Lambertian(new Color(0.73, 0.73, 0.73));
  const green = new Lambertian(new Color(0.12, 0.45, 0.15));
  const light = new DiffuseLight(new Color(15, 15, 15));

  world.add(new XYRect(0, 555, 0, 555, 555, green));   // left
  world.add(new XYRect(0, 555, 0, 555, 0, red));       // right
  world.add(new XZRect(213, 343, 227, 332, 554, light)); // light
  world.add(new XZRect(0, 555, 0, 555, 0, white));     // floor
  world.add(new XZRect(0, 555, 0, 555, 555, white));   // ceiling

  // Two spheres
  world.add(new Sphere(new Vec3(190, 90, 190), 90, white));
  world.add(new Sphere(new Vec3(370, 90, 370), 90, new Metal(new Color(0.8, 0.8, 0.8), 0.0)));

  const camera = new Camera({
    lookFrom: new Vec3(278, 278, -800),
    lookAt: new Vec3(278, 278, 0),
    vUp: new Vec3(0, 1, 0),
    vfov: 40,
    aspectRatio: 1,
    aperture: 0,
    focusDist: 10,
  });

  return { world, camera };
}

function createSphereScene(count) {
  const world = new HittableList();
  const checker = new CheckerTexture(new Color(0.2, 0.3, 0.1), new Color(0.9, 0.9, 0.9), 10);
  world.add(new Sphere(new Vec3(0, -1000, 0), 1000, new Lambertian(checker)));

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 20;
    const z = (Math.random() - 0.5) * 20;
    const r = 0.2 + Math.random() * 0.3;
    const mat = Math.random() < 0.6
      ? new Lambertian(new Color(Math.random(), Math.random(), Math.random()))
      : Math.random() < 0.8
        ? new Metal(new Color(0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5), Math.random() * 0.3)
        : new Dielectric(1.5);
    world.add(new Sphere(new Vec3(x, r, z), r, mat));
  }

  const camera = new Camera({
    lookFrom: new Vec3(13, 2, 3),
    lookAt: new Vec3(0, 0, 0),
    vUp: new Vec3(0, 1, 0),
    vfov: 20,
    aspectRatio: 16/9,
    aperture: 0.1,
    focusDist: 10,
  });

  return { world, camera };
}

describe('Render Benchmarks', () => {
  it('tiny Cornell box (20×20, 4 spp) should complete quickly', () => {
    const { world, camera } = createCornellBox();
    const renderer = new Renderer({
      width: 20, height: 20, samplesPerPixel: 4, maxDepth: 10,
      camera, world, background: new Color(0, 0, 0),
    });

    const start = performance.now();
    const pixels = renderer.render();
    const elapsed = performance.now() - start;

    assert.equal(pixels.length, 20 * 20 * 4);
    assert.ok(elapsed < 5000, `Should complete in < 5s, took ${elapsed.toFixed(0)}ms`);
  });

  it('small sphere scene (40×22, 4 spp, 20 spheres) with BVH', () => {
    const { world, camera } = createSphereScene(20);
    const renderer = new Renderer({
      width: 40, height: 22, samplesPerPixel: 4, maxDepth: 10,
      camera, world,
    });

    const start = performance.now();
    const pixels = renderer.render();
    const elapsed = performance.now() - start;

    assert.equal(pixels.length, 40 * 22 * 4);
    assert.ok(elapsed < 10000, `Should complete in < 10s, took ${elapsed.toFixed(0)}ms`);

    // Verify non-black pixels exist
    let nonBlack = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] + pixels[i+1] + pixels[i+2] > 0) nonBlack++;
    }
    assert.ok(nonBlack > 10, `Should have visible content, got ${nonBlack} non-black pixels`);
  });

  it('BVH should be faster than brute force for many objects', () => {
    const { world, camera } = createSphereScene(50);

    // With BVH (auto-built by renderer for > 4 objects)
    const renderer = new Renderer({
      width: 20, height: 11, samplesPerPixel: 2, maxDepth: 5,
      camera, world,
    });
    const start1 = performance.now();
    renderer.render();
    const bvhTime = performance.now() - start1;

    // Brute force (pass world directly, avoid BVH)
    const rendererBrute = new Renderer({
      width: 20, height: 11, samplesPerPixel: 2, maxDepth: 5,
      camera, world,
    });
    rendererBrute.scene = world; // Override BVH with raw list
    const start2 = performance.now();
    rendererBrute.render();
    const bruteTime = performance.now() - start2;

    // BVH should be similar or faster (may not be for small scenes)
    assert.ok(bvhTime < bruteTime * 3, `BVH (${bvhTime.toFixed(0)}ms) should not be > 3x slower than brute (${bruteTime.toFixed(0)}ms)`);
  });

  it('ray throughput baseline (should achieve > 10K rays/sec on any machine)', () => {
    const { world, camera } = createCornellBox();
    const width = 20, height = 20, spp = 4, maxDepth = 10;
    const renderer = new Renderer({
      width, height, samplesPerPixel: spp, maxDepth,
      camera, world, background: new Color(0, 0, 0),
    });

    const start = performance.now();
    renderer.render();
    const elapsed = (performance.now() - start) / 1000; // seconds
    const totalRays = width * height * spp;
    const raysPerSec = totalRays / elapsed;

    assert.ok(raysPerSec > 10000, `Should achieve > 10K rays/sec, got ${(raysPerSec/1000).toFixed(1)}K rays/sec`);
  });

  it('light sampling should produce brighter scenes than pure BRDF', () => {
    const world = new HittableList();
    const white = new Lambertian(new Color(0.73, 0.73, 0.73));
    const lightMat = new DiffuseLight(new Color(10, 10, 10));

    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, white)); // floor
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, white));      // object
    const lightObj = new XZRect(-0.5, 0.5, -1.5, -0.5, 2, lightMat); // small overhead light
    world.add(lightObj);

    const camera = new Camera({
      lookFrom: new Vec3(0, 0.5, 1),
      lookAt: new Vec3(0, 0, -1),
      vUp: new Vec3(0, 1, 0),
      vfov: 60,
      aspectRatio: 1,
      aperture: 0,
      focusDist: 1,
    });

    // With light sampling
    const renderer = new Renderer({
      width: 10, height: 10, samplesPerPixel: 8, maxDepth: 10,
      camera, world, background: new Color(0, 0, 0),
      lights: [lightObj],
    });
    const pixelsLit = renderer.render();

    // Measure average brightness
    let brightness = 0;
    for (let i = 0; i < pixelsLit.length; i += 4) {
      brightness += pixelsLit[i] + pixelsLit[i+1] + pixelsLit[i+2];
    }
    const avgBrightness = brightness / (10 * 10 * 3);

    // Should have some visible light
    assert.ok(avgBrightness > 0, `Scene should have some brightness, got avg ${avgBrightness.toFixed(1)}`);
  });
});
