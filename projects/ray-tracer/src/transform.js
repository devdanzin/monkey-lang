// transform.js — Translate and Rotate wrappers for hittable objects

import { Vec3 } from './vec3.js';
import { Ray } from './ray.js';
import { AABB } from './aabb.js';

// Translate: move an object by an offset
export class Translate {
  constructor(object, offset) {
    this.object = object;
    this.offset = offset;
  }

  hit(ray, tMin, tMax) {
    // Move the ray in the opposite direction instead of moving the object
    const movedRay = new Ray(ray.origin.sub(this.offset), ray.direction);
    const rec = this.object.hit(movedRay, tMin, tMax);
    if (!rec) return null;
    rec.p = rec.p.add(this.offset);
    rec.setFaceNormal(movedRay, rec.normal);
    return rec;
  }

  boundingBox() {
    const box = this.object.boundingBox();
    if (!box) return null;
    return new AABB(box.minimum.add(this.offset), box.maximum.add(this.offset));
  }
}

// Rotate around Y axis
export class RotateY {
  constructor(object, angle) {
    this.object = object;
    const radians = angle * Math.PI / 180;
    this.sinTheta = Math.sin(radians);
    this.cosTheta = Math.cos(radians);

    // Compute bounding box of rotated object
    const box = object.boundingBox();
    if (box) {
      let min = new Vec3(Infinity, Infinity, Infinity);
      let max = new Vec3(-Infinity, -Infinity, -Infinity);

      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          for (let k = 0; k < 2; k++) {
            const x = i * box.maximum.x + (1 - i) * box.minimum.x;
            const y = j * box.maximum.y + (1 - j) * box.minimum.y;
            const z = k * box.maximum.z + (1 - k) * box.minimum.z;

            const newX = this.cosTheta * x + this.sinTheta * z;
            const newZ = -this.sinTheta * x + this.cosTheta * z;

            min = new Vec3(Math.min(min.x, newX), Math.min(min.y, y), Math.min(min.z, newZ));
            max = new Vec3(Math.max(max.x, newX), Math.max(max.y, y), Math.max(max.z, newZ));
          }
        }
      }
      this.box = new AABB(min, max);
    } else {
      this.box = null;
    }
  }

  hit(ray, tMin, tMax) {
    // Rotate the ray in the opposite direction
    const origin = new Vec3(
      this.cosTheta * ray.origin.x - this.sinTheta * ray.origin.z,
      ray.origin.y,
      this.sinTheta * ray.origin.x + this.cosTheta * ray.origin.z
    );
    const direction = new Vec3(
      this.cosTheta * ray.direction.x - this.sinTheta * ray.direction.z,
      ray.direction.y,
      this.sinTheta * ray.direction.x + this.cosTheta * ray.direction.z
    );

    const rotatedRay = new Ray(origin, direction);
    const rec = this.object.hit(rotatedRay, tMin, tMax);
    if (!rec) return null;

    // Rotate the hit point and normal back
    const p = new Vec3(
      this.cosTheta * rec.p.x + this.sinTheta * rec.p.z,
      rec.p.y,
      -this.sinTheta * rec.p.x + this.cosTheta * rec.p.z
    );
    const normal = new Vec3(
      this.cosTheta * rec.normal.x + this.sinTheta * rec.normal.z,
      rec.normal.y,
      -this.sinTheta * rec.normal.x + this.cosTheta * rec.normal.z
    );

    rec.p = p;
    rec.setFaceNormal(rotatedRay, normal);
    return rec;
  }

  boundingBox() {
    return this.box;
  }
}
