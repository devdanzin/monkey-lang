// sphere.js — Ray-sphere intersection

import { HitRecord } from './hittable.js';
import { Vec3 } from './vec3.js';
import { AABB } from './aabb.js';

export class Sphere {
  constructor(center, radius, material) {
    this.center = center;
    this.radius = radius;
    this.material = material;
  }

  hit(ray, tMin, tMax) {
    const oc = ray.origin.sub(this.center);
    const a = ray.direction.lengthSquared();
    const halfB = oc.dot(ray.direction);
    const c = oc.lengthSquared() - this.radius * this.radius;
    const discriminant = halfB * halfB - a * c;

    if (discriminant < 0) return null;

    const sqrtd = Math.sqrt(discriminant);

    // Find the nearest root in the acceptable range
    let root = (-halfB - sqrtd) / a;
    if (root <= tMin || root >= tMax) {
      root = (-halfB + sqrtd) / a;
      if (root <= tMin || root >= tMax) return null;
    }

    const rec = new HitRecord();
    rec.t = root;
    rec.p = ray.at(root);
    const outwardNormal = rec.p.sub(this.center).div(this.radius);
    rec.setFaceNormal(ray, outwardNormal);
    rec.material = this.material;

    return rec;
  }

  boundingBox() {
    const r = new Vec3(this.radius, this.radius, this.radius);
    return new AABB(this.center.sub(r), this.center.add(r));
  }
}
