import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Ray, Sphere, Box, Lambertian, Color, CSGUnion, CSGIntersection, CSGDifference } from '../src/index.js';

const mat = new Lambertian(new Color(0.5, 0.5, 0.5));

describe('CSG Union', () => {
  it('hits either object', () => {
    const a = new Sphere(new Vec3(-1, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(1, 0, -3), 1, mat);
    const u = new CSGUnion(a, b);
    const ray = new Ray(new Vec3(-1, 0, 0), new Vec3(0, 0, -1));
    assert.ok(u.hit(ray, 0.001, Infinity));
  });

  it('returns closer hit', () => {
    const a = new Sphere(new Vec3(0, 0, -2), 0.5, mat);
    const b = new Sphere(new Vec3(0, 0, -5), 0.5, mat);
    const u = new CSGUnion(a, b);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = u.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    assert.ok(rec.t < 3);
  });

  it('has bounding box', () => {
    const a = new Sphere(new Vec3(-1, 0, 0), 0.5, mat);
    const b = new Sphere(new Vec3(1, 0, 0), 0.5, mat);
    const u = new CSGUnion(a, b);
    const box = u.boundingBox();
    assert.ok(box);
    assert.ok(box.minimum.x <= -1.5);
    assert.ok(box.maximum.x >= 1.5);
  });

  it('misses when ray misses both', () => {
    const a = new Sphere(new Vec3(-5, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(5, 0, -3), 1, mat);
    const u = new CSGUnion(a, b);
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    assert.equal(u.hit(ray, 0.001, Infinity), null);
  });

  it('nested union of three objects', () => {
    const a = new Sphere(new Vec3(-2, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(0, 0, -3), 1, mat);
    const c = new Sphere(new Vec3(2, 0, -3), 1, mat);
    const u = new CSGUnion(new CSGUnion(a, b), c);
    
    // Hit center sphere
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    assert.ok(u.hit(ray, 0.001, Infinity));
    
    // Hit right sphere
    const ray2 = new Ray(new Vec3(2, 0, 0), new Vec3(0, 0, -1));
    assert.ok(u.hit(ray2, 0.001, Infinity));
  });
});

describe('CSG Intersection', () => {
  it('hits where overlapping spheres intersect', () => {
    // Two overlapping spheres
    const a = new Sphere(new Vec3(-0.3, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(0.3, 0, -3), 1, mat);
    const inter = new CSGIntersection(a, b);
    
    // Ray through overlap region
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = inter.hit(ray, 0.001, Infinity);
    assert.ok(rec, 'Should hit in overlap region');
  });

  it('misses where only one sphere exists', () => {
    const a = new Sphere(new Vec3(-3, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(3, 0, -3), 1, mat);
    const inter = new CSGIntersection(a, b);
    
    // Ray through sphere A only
    const ray = new Ray(new Vec3(-3, 0, 0), new Vec3(0, 0, -1));
    const rec = inter.hit(ray, 0.001, Infinity);
    assert.equal(rec, null, 'Should not hit where only A exists');
  });

  it('bounding box is intersection of boxes', () => {
    const a = new Sphere(new Vec3(-1, 0, 0), 2, mat);
    const b = new Sphere(new Vec3(1, 0, 0), 2, mat);
    const inter = new CSGIntersection(a, b);
    const box = inter.boundingBox();
    assert.ok(box);
    // Intersection of [-3,1] and [-1,3] in x = [-1,1]
    assert.ok(box.minimum.x >= -1.1);
    assert.ok(box.maximum.x <= 1.1);
  });
});

describe('CSG Difference', () => {
  it('hits A surface when outside B', () => {
    // Sphere A at center, small sphere B nearby but not overlapping
    const a = new Sphere(new Vec3(0, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(5, 0, -3), 0.5, mat);
    const diff = new CSGDifference(a, b);
    
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = diff.hit(ray, 0.001, Infinity);
    assert.ok(rec, 'Should hit A when B is elsewhere');
  });

  it('creates a hole when B overlaps A', () => {
    // Sphere A at center, B overlapping front surface
    const a = new Sphere(new Vec3(0, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(0, 0, -2.2), 0.5, mat);
    const diff = new CSGDifference(a, b);
    
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = diff.hit(ray, 0.001, Infinity);
    // The front surface of A is inside B, so we should see through
    // to either the back of B or the back of A
    if (rec) {
      assert.ok(rec.t > 1.5, 'Hit should be further than front of A');
    }
  });

  it('bounding box is same as A', () => {
    const a = new Sphere(new Vec3(0, 0, 0), 2, mat);
    const b = new Sphere(new Vec3(0, 0, 0), 1, mat);
    const diff = new CSGDifference(a, b);
    const box = diff.boundingBox();
    const boxA = a.boundingBox();
    assert.ok(box);
    assert.ok(Math.abs(box.minimum.x - boxA.minimum.x) < 0.01);
  });

  it('completely subtracting removes the hit', () => {
    // B completely contains A
    const a = new Sphere(new Vec3(0, 0, -3), 0.5, mat);
    const b = new Sphere(new Vec3(0, 0, -3), 2, mat);
    const diff = new CSGDifference(a, b);
    
    const ray = new Ray(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    const rec = diff.hit(ray, 0.001, Infinity);
    assert.equal(rec, null, 'A is entirely inside B, nothing to see');
  });
});

describe('CSG nesting', () => {
  it('union of difference and sphere', () => {
    // (A - B) ∪ C
    const a = new Sphere(new Vec3(0, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(0, 0, -2.5), 0.5, mat);
    const c = new Sphere(new Vec3(2, 0, -3), 0.5, mat);
    const result = new CSGUnion(new CSGDifference(a, b), c);
    
    // Should hit C from the right
    const ray = new Ray(new Vec3(2, 0, 0), new Vec3(0, 0, -1));
    assert.ok(result.hit(ray, 0.001, Infinity));
  });

  it('difference of union', () => {
    // (A ∪ B) - C
    const a = new Sphere(new Vec3(-1, 0, -3), 1, mat);
    const b = new Sphere(new Vec3(1, 0, -3), 1, mat);
    const c = new Sphere(new Vec3(0, 0, -3), 0.5, mat);
    const result = new CSGDifference(new CSGUnion(a, b), c);
    
    const ray = new Ray(new Vec3(-1, 0, 0), new Vec3(0, 0, -1));
    const rec = result.hit(ray, 0.001, Infinity);
    assert.ok(rec, 'Should hit A part of union');
  });
});
