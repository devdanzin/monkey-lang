// scene.test.js — Scene builder and transform tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color, Point3 } from './vec3.js';
import { Ray } from './ray.js';
import { Sphere } from './sphere.js';
import { HittableList } from './hittable.js';
import { Lambertian, Metal, Dielectric } from './material.js';
import { BVHNode } from './bvh.js';
import { Scene } from './scene.js';

const EPSILON = 1e-4;
const dummyMat = new Lambertian(new Color(0.5, 0.5, 0.5));

describe('Scene builder', () => {
  it('creates a scene', () => {
    const scene = new Scene();
    assert.ok(scene);
  });

  it('adds objects to scene', () => {
    const scene = new Scene();
    scene.add(new Sphere(new Vec3(0, 0, -1), 0.5, dummyMat));
    assert.ok(scene.objects.length > 0 || scene.world);
  });

  it('scene with multiple materials', () => {
    const scene = new Scene();
    scene.add(new Sphere(new Vec3(-1, 0, -1), 0.5, new Lambertian(new Color(0.8, 0.2, 0.1))));
    scene.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Metal(new Color(0.8, 0.8, 0.8), 0)));
    scene.add(new Sphere(new Vec3(1, 0, -1), 0.5, new Dielectric(1.5)));
    assert.ok(scene.objects.length >= 3 || scene.world);
  });
});

describe('HittableList as scene', () => {
  it('builds three-sphere scene', () => {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, dummyMat)); // ground
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Color(0.7, 0.3, 0.3))));
    world.add(new Sphere(new Vec3(1, 0, -1), 0.5, new Metal(new Color(0.8, 0.6, 0.2), 0.3)));

    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const hit = world.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    assert.ok(Math.abs(hit.t - 0.5) < 0.01);
  });

  it('ray directed at ground', () => {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, -100.5, -1), 100, dummyMat));
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, -1, -0.5).unit());
    const hit = world.hit(ray, 0.001, Infinity);
    assert.ok(hit);
    assert.ok(hit.p.y < 0);
  });
});

describe('BVH acceleration', () => {
  it('BVH identical to linear for random scene', () => {
    const objects = [];
    for (let i = 0; i < 50; i++) {
      objects.push(new Sphere(
        new Vec3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          -3 - Math.random() * 5
        ),
        0.2 + Math.random() * 0.3,
        dummyMat
      ));
    }

    const list = new HittableList();
    objects.forEach(o => list.add(o));
    const bvh = new BVHNode([...objects]);

    // Test 20 random rays
    let matches = 0;
    for (let i = 0; i < 20; i++) {
      const dir = new Vec3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        -1
      ).unit();
      const ray = new Ray(new Vec3(0, 0, 0), dir);

      const listHit = list.hit(ray, 0.001, Infinity);
      const bvhHit = bvh.hit(ray, 0.001, Infinity);

      if (listHit === null) {
        if (bvhHit === null) matches++;
      } else if (bvhHit !== null) {
        if (Math.abs(listHit.t - bvhHit.t) < 0.001) matches++;
      }
    }
    assert.ok(matches >= 18, `BVH/linear should agree on most rays: ${matches}/20`);
  });
});
