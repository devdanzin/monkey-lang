import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from '../src/vec3.js';
import { Ray } from '../src/ray.js';
import { Sphere } from '../src/sphere.js';
import { BVHNode } from '../src/bvh.js';
import { Lambertian, Color } from '../src/index.js';

describe('BVH SAH Construction', () => {
  it('builds SAH BVH for many objects', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const spheres = [];
    for (let i = 0; i < 50; i++) {
      spheres.push(new Sphere(
        new Vec3(Math.random() * 100, Math.random() * 100, Math.random() * 100),
        1, mat
      ));
    }
    const bvh = new BVHNode(spheres, 0, spheres.length, true);
    assert.ok(bvh.box, 'Should have bounding box');
  });

  it('SAH BVH produces correct hit results', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const spheres = [
      new Sphere(new Vec3(0, 0, -5), 1, mat),
      new Sphere(new Vec3(3, 0, -5), 1, mat),
      new Sphere(new Vec3(-3, 0, -5), 1, mat),
    ];
    const bvh = new BVHNode([...spheres], 0, 3, true);
    
    // Shoot ray straight ahead
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = bvh.hit(ray, 0.001, Infinity);
    assert.ok(hit, 'Should hit center sphere');
    assert.ok(Math.abs(hit.t - 4) < 0.1, `t: ${hit.t}`);
  });

  it('SAH BVH handles degenerate cases', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    // All objects at same position
    const spheres = [];
    for (let i = 0; i < 10; i++) {
      spheres.push(new Sphere(new Vec3(0, 0, 0), 1, mat));
    }
    const bvh = new BVHNode(spheres, 0, 10, true);
    assert.ok(bvh.box);
  });

  it('SAH BVH with large scene', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const spheres = [];
    for (let i = 0; i < 200; i++) {
      spheres.push(new Sphere(
        new Vec3(i * 3, (i % 10) * 3, 0),
        1, mat
      ));
    }
    
    const start = performance.now();
    const bvh = new BVHNode(spheres, 0, spheres.length, true);
    const buildTime = performance.now() - start;
    
    // Query performance
    let hits = 0;
    const queryStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      const ray = new Ray(
        new Vec3(Math.random() * 600, 15, 10),
        new Vec3(0, 0, -1)
      );
      if (bvh.hit(ray, 0.001, Infinity)) hits++;
    }
    const queryTime = performance.now() - queryStart;
    
    console.log(`  SAH BVH (200 objects): build=${buildTime.toFixed(1)}ms, 1000 queries=${queryTime.toFixed(1)}ms`);
    assert.ok(buildTime < 1000, `Build too slow: ${buildTime}ms`);
    assert.ok(queryTime < 500, `Queries too slow: ${queryTime}ms`);
  });

  it('useSAH=false falls back to median', () => {
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const spheres = [];
    for (let i = 0; i < 20; i++) {
      spheres.push(new Sphere(new Vec3(i * 3, 0, 0), 1, mat));
    }
    const bvh = new BVHNode(spheres, 0, 20, false);
    assert.ok(bvh.box);
    
    const ray = new Ray(new Vec3(0, 0, 1), new Vec3(0, 0, -1));
    const hit = bvh.hit(ray, 0.001, Infinity);
    assert.ok(hit, 'Median BVH should also work correctly');
  });
});
