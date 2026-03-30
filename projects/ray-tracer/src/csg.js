// csg.js — Constructive Solid Geometry (Union, Intersection, Difference)

import { AABB } from './aabb.js';
import { Vec3 } from './vec3.js';

// CSG works by finding all intersections of a ray with both objects,
// then combining the intervals based on the operation.

// CSG Union: A ∪ B (returns the first hit of either)
export class CSGUnion {
  constructor(a, b) {
    this.a = a;
    this.b = b;
  }

  hit(ray, tMin, tMax) {
    const hitA = this.a.hit(ray, tMin, tMax);
    const hitB = this.b.hit(ray, tMin, tMax);

    if (!hitA) return hitB;
    if (!hitB) return hitA;
    return hitA.t < hitB.t ? hitA : hitB;
  }

  boundingBox() {
    const boxA = this.a.boundingBox();
    const boxB = this.b.boundingBox();
    if (!boxA) return boxB;
    if (!boxB) return boxA;
    return AABB.surrounding(boxA, boxB);
  }
}

// CSG Intersection: A ∩ B (only where both overlap)
// Approximate: hits A only if the hit point is inside B
export class CSGIntersection {
  constructor(a, b) {
    this.a = a;
    this.b = b;
  }

  hit(ray, tMin, tMax) {
    // Try hitting A, check if point is inside B (by testing a tiny ray from the hit point)
    const hitA = this.a.hit(ray, tMin, tMax);
    if (hitA) {
      // Check if this point is inside B by shooting a ray inward
      const testRay = { origin: hitA.p, direction: hitA.normal.negate(), time: ray.time || 0 };
      testRay.at = (t) => testRay.origin.add(testRay.direction.mul(t));
      const insideB = this.b.hit(testRay, 0.001, 100);
      if (insideB) return hitA;
    }

    // Try hitting B, check if point is inside A
    const hitB = this.b.hit(ray, tMin, tMax);
    if (hitB) {
      const testRay = { origin: hitB.p, direction: hitB.normal.negate(), time: ray.time || 0 };
      testRay.at = (t) => testRay.origin.add(testRay.direction.mul(t));
      const insideA = this.a.hit(testRay, 0.001, 100);
      if (insideA) return hitB;
    }

    return null;
  }

  boundingBox() {
    // Intersection is at most as big as the smaller object
    const boxA = this.a.boundingBox();
    const boxB = this.b.boundingBox();
    if (!boxA || !boxB) return null;
    // Return intersection of bounding boxes
    return new AABB(
      new Vec3(Math.max(boxA.minimum.x, boxB.minimum.x), Math.max(boxA.minimum.y, boxB.minimum.y), Math.max(boxA.minimum.z, boxB.minimum.z)),
      new Vec3(Math.min(boxA.maximum.x, boxB.maximum.x), Math.min(boxA.maximum.y, boxB.maximum.y), Math.min(boxA.maximum.z, boxB.maximum.z))
    );
  }
}

// CSG Difference: A - B (A but not B)
// Hit A only if the hit point is NOT inside B
export class CSGDifference {
  constructor(a, b) {
    this.a = a;
    this.b = b;
  }

  hit(ray, tMin, tMax) {
    const hitA = this.a.hit(ray, tMin, tMax);
    if (!hitA) return null;

    // Check if hit point is inside B
    const testRay = { origin: hitA.p, direction: hitA.normal.negate(), time: ray.time || 0 };
    testRay.at = (t) => testRay.origin.add(testRay.direction.mul(t));
    const insideB = this.b.hit(testRay, 0.001, 100);

    if (insideB) {
      // The surface hit of A is inside B — try to find the exit of B instead
      const hitB = this.b.hit(ray, tMin, tMax);
      if (hitB && hitB.t > hitA.t) {
        // Return the B surface (inverted normal) as the new surface
        hitB.normal = hitB.normal.negate();
        hitB.frontFace = !hitB.frontFace;
        hitB.material = hitA.material; // Use A's material
        return hitB;
      }
      return null; // Entirely inside B
    }

    return hitA; // Outside B, normal A hit
  }

  boundingBox() {
    return this.a.boundingBox();
  }
}
