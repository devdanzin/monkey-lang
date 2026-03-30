import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color, Point3, Ray, Sphere, HittableList, Lambertian, Metal, Dielectric, Camera, Renderer } from '../src/index.js';

describe('Vec3', () => {
  it('add', () => {
    const a = new Vec3(1, 2, 3);
    const b = new Vec3(4, 5, 6);
    const c = a.add(b);
    assert.equal(c.x, 5);
    assert.equal(c.y, 7);
    assert.equal(c.z, 9);
  });

  it('sub', () => {
    const c = new Vec3(5, 7, 9).sub(new Vec3(1, 2, 3));
    assert.equal(c.x, 4);
    assert.equal(c.y, 5);
    assert.equal(c.z, 6);
  });

  it('mul scalar', () => {
    const c = new Vec3(1, 2, 3).mul(2);
    assert.equal(c.x, 2);
    assert.equal(c.y, 4);
    assert.equal(c.z, 6);
  });

  it('mul vec (component-wise)', () => {
    const c = new Vec3(2, 3, 4).mul(new Vec3(5, 6, 7));
    assert.equal(c.x, 10);
    assert.equal(c.y, 18);
    assert.equal(c.z, 28);
  });

  it('div', () => {
    const c = new Vec3(6, 8, 10).div(2);
    assert.equal(c.x, 3);
    assert.equal(c.y, 4);
    assert.equal(c.z, 5);
  });

  it('dot', () => {
    assert.equal(new Vec3(1, 2, 3).dot(new Vec3(4, 5, 6)), 32);
  });

  it('cross', () => {
    const c = new Vec3(1, 0, 0).cross(new Vec3(0, 1, 0));
    assert.equal(c.x, 0);
    assert.equal(c.y, 0);
    assert.equal(c.z, 1);
  });

  it('length', () => {
    assert.ok(Math.abs(new Vec3(3, 4, 0).length() - 5) < 1e-10);
  });

  it('unit', () => {
    const u = new Vec3(0, 3, 0).unit();
    assert.ok(Math.abs(u.length() - 1) < 1e-10);
    assert.ok(Math.abs(u.y - 1) < 1e-10);
  });

  it('reflect', () => {
    const v = new Vec3(1, -1, 0);
    const n = new Vec3(0, 1, 0);
    const r = v.reflect(n);
    assert.ok(Math.abs(r.x - 1) < 1e-10);
    assert.ok(Math.abs(r.y - 1) < 1e-10);
  });

  it('nearZero', () => {
    assert.ok(new Vec3(1e-9, 1e-9, 1e-9).nearZero());
    assert.ok(!new Vec3(1, 0, 0).nearZero());
  });

  it('lerp', () => {
    const a = new Vec3(0, 0, 0);
    const b = new Vec3(10, 10, 10);
    const m = a.lerp(b, 0.5);
    assert.equal(m.x, 5);
    assert.equal(m.y, 5);
  });

  it('clamp', () => {
    const c = new Vec3(-0.5, 0.5, 1.5).clamp(0, 1);
    assert.equal(c.x, 0);
    assert.equal(c.y, 0.5);
    assert.equal(c.z, 1);
  });

  it('random', () => {
    const r = Vec3.random();
    assert.ok(r.x >= 0 && r.x <= 1);
    assert.ok(r.y >= 0 && r.y <= 1);
  });

  it('randomInUnitSphere', () => {
    for (let i = 0; i < 100; i++) {
      assert.ok(Vec3.randomInUnitSphere().lengthSquared() < 1);
    }
  });

  it('randomUnitVector', () => {
    for (let i = 0; i < 100; i++) {
      assert.ok(Math.abs(Vec3.randomUnitVector().length() - 1) < 1e-6);
    }
  });
});

describe('Ray', () => {
  it('at(t)', () => {
    const r = new Ray(new Point3(0, 0, 0), new Vec3(1, 0, 0));
    const p = r.at(5);
    assert.equal(p.x, 5);
    assert.equal(p.y, 0);
  });
});

describe('Sphere', () => {
  it('ray hits sphere', () => {
    const s = new Sphere(new Point3(0, 0, -1), 0.5, new Lambertian(new Color(1, 0, 0)));
    const r = new Ray(new Point3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = s.hit(r, 0.001, Infinity);
    assert.ok(rec !== null);
    assert.ok(Math.abs(rec.t - 0.5) < 1e-6);
  });

  it('ray misses sphere', () => {
    const s = new Sphere(new Point3(0, 0, -1), 0.5, new Lambertian(new Color(1, 0, 0)));
    const r = new Ray(new Point3(0, 0, 0), new Vec3(0, 1, 0));
    assert.equal(s.hit(r, 0.001, Infinity), null);
  });

  it('front face normal', () => {
    const s = new Sphere(new Point3(0, 0, -1), 0.5, new Lambertian(new Color(1, 0, 0)));
    const r = new Ray(new Point3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = s.hit(r, 0.001, Infinity);
    assert.ok(rec.frontFace);
  });
});

describe('HittableList', () => {
  it('closest hit', () => {
    const world = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    world.add(new Sphere(new Point3(0, 0, -1), 0.5, mat));
    world.add(new Sphere(new Point3(0, 0, -3), 0.5, mat));
    const r = new Ray(new Point3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = world.hit(r, 0.001, Infinity);
    assert.ok(rec !== null);
    assert.ok(Math.abs(rec.t - 0.5) < 1e-6); // Should hit the closer one
  });
});

describe('Materials', () => {
  it('Lambertian scatter', () => {
    const mat = new Lambertian(new Color(0.8, 0.3, 0.3));
    const rec = { p: new Point3(0, 0, 0), normal: new Vec3(0, 1, 0) };
    const result = mat.scatter(null, rec);
    assert.ok(result !== null);
    assert.ok(result.scattered);
    assert.equal(result.attenuation.x, 0.8);
  });

  it('Metal scatter', () => {
    const mat = new Metal(new Color(0.8, 0.8, 0.8), 0);
    const ray = new Ray(new Point3(0, 1, 0), new Vec3(1, -1, 0).unit());
    const rec = { p: new Point3(1, 0, 0), normal: new Vec3(0, 1, 0) };
    const result = mat.scatter(ray, rec);
    assert.ok(result !== null);
    assert.ok(result.scattered.direction.y > 0); // Reflected upward
  });

  it('Dielectric scatter', () => {
    const mat = new Dielectric(1.5);
    const ray = new Ray(new Point3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = { p: new Point3(0, 0, -1), normal: new Vec3(0, 0, 1), frontFace: true };
    const result = mat.scatter(ray, rec);
    assert.ok(result !== null);
    assert.equal(result.attenuation.x, 1);
  });
});

describe('Camera', () => {
  it('generates rays', () => {
    const cam = new Camera({
      lookFrom: new Point3(0, 0, 0),
      lookAt: new Point3(0, 0, -1),
      vfov: 90,
      aspectRatio: 2
    });
    const ray = cam.getRay(0.5, 0.5);
    assert.ok(ray.origin);
    assert.ok(ray.direction);
    // Center ray should point roughly toward -z
    assert.ok(ray.direction.z < 0);
  });
});

describe('Renderer', () => {
  it('renders a small image', () => {
    const world = new HittableList();
    world.add(new Sphere(new Point3(0, 0, -1), 0.5, new Lambertian(new Color(0.7, 0.3, 0.3))));
    world.add(new Sphere(new Point3(0, -100.5, -1), 100, new Lambertian(new Color(0.8, 0.8, 0.0))));

    const cam = new Camera({
      lookFrom: new Point3(0, 0, 0),
      lookAt: new Point3(0, 0, -1),
      vfov: 90,
      aspectRatio: 2
    });

    const renderer = new Renderer({
      width: 10,
      height: 5,
      samplesPerPixel: 4,
      maxDepth: 10,
      camera: cam,
      world
    });

    const pixels = renderer.render();
    assert.equal(pixels.length, 10 * 5 * 4); // RGBA
    // All alpha should be 255
    for (let i = 3; i < pixels.length; i += 4) {
      assert.equal(pixels[i], 255);
    }
  });

  it('sky gradient for missed rays', () => {
    const world = new HittableList(); // empty
    const cam = new Camera();
    const renderer = new Renderer({
      width: 4, height: 2, samplesPerPixel: 1, maxDepth: 1,
      camera: cam, world
    });
    const pixels = renderer.render();
    // Should have some blue-ish pixels from sky gradient
    let hasBlue = false;
    for (let i = 2; i < pixels.length; i += 4) {
      if (pixels[i] > 100) hasBlue = true;
    }
    assert.ok(hasBlue);
  });
});
