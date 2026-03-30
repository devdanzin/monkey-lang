// aabb.js — Axis-Aligned Bounding Box

import { Vec3 } from './vec3.js';

export class AABB {
  constructor(minimum, maximum) {
    this.minimum = minimum; // Vec3
    this.maximum = maximum; // Vec3
  }

  hit(ray, tMin, tMax) {
    // Slab method — unrolled for performance
    const ox = ray.origin.x, oy = ray.origin.y, oz = ray.origin.z;
    const dx = ray.direction.x, dy = ray.direction.y, dz = ray.direction.z;
    const mnx = this.minimum.x, mny = this.minimum.y, mnz = this.minimum.z;
    const mxx = this.maximum.x, mxy = this.maximum.y, mxz = this.maximum.z;

    // X axis
    let invD = 1.0 / dx;
    let t0 = (mnx - ox) * invD;
    let t1 = (mxx - ox) * invD;
    if (invD < 0) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMax <= tMin) return false;

    // Y axis
    invD = 1.0 / dy;
    t0 = (mny - oy) * invD;
    t1 = (mxy - oy) * invD;
    if (invD < 0) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMax <= tMin) return false;

    // Z axis
    invD = 1.0 / dz;
    t0 = (mnz - oz) * invD;
    t1 = (mxz - oz) * invD;
    if (invD < 0) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMax <= tMin) return false;

    return true;
  }

  // Merge two bounding boxes
  static surrounding(box0, box1) {
    const small = new Vec3(
      Math.min(box0.minimum.x, box1.minimum.x),
      Math.min(box0.minimum.y, box1.minimum.y),
      Math.min(box0.minimum.z, box1.minimum.z)
    );
    const big = new Vec3(
      Math.max(box0.maximum.x, box1.maximum.x),
      Math.max(box0.maximum.y, box1.maximum.y),
      Math.max(box0.maximum.z, box1.maximum.z)
    );
    return new AABB(small, big);
  }
}
