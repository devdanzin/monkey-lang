// moving-sphere.js — Sphere that moves linearly between two centers over time [0,1]

import { Vec3 } from './vec3.js';
import { HitRecord } from './hittable.js';
import { AABB } from './aabb.js';

export class MovingSphere {
  constructor(center0, center1, time0, time1, radius, material) {
    this.center0 = center0;
    this.center1 = center1;
    this.time0 = time0;
    this.time1 = time1;
    this.radius = radius;
    this.material = material;
  }

  center(time) {
    const t = (time - this.time0) / (this.time1 - this.time0);
    return this.center0.add(this.center1.sub(this.center0).mul(t));
  }

  hit(ray, tMin, tMax) {
    const currentCenter = this.center(ray.time);
    const oc = ray.origin.sub(currentCenter);
    const a = ray.direction.lengthSquared();
    const halfB = oc.dot(ray.direction);
    const c = oc.lengthSquared() - this.radius * this.radius;
    const discriminant = halfB * halfB - a * c;

    if (discriminant < 0) return null;

    const sqrtd = Math.sqrt(discriminant);
    let root = (-halfB - sqrtd) / a;
    if (root <= tMin || root >= tMax) {
      root = (-halfB + sqrtd) / a;
      if (root <= tMin || root >= tMax) return null;
    }

    const rec = new HitRecord();
    rec.t = root;
    rec.p = ray.at(root);
    const outwardNormal = rec.p.sub(currentCenter).div(this.radius);
    rec.setFaceNormal(ray, outwardNormal);
    rec.material = this.material;

    return rec;
  }

  boundingBox() {
    const r = new Vec3(this.radius, this.radius, this.radius);
    const box0 = new AABB(this.center0.sub(r), this.center0.add(r));
    const box1 = new AABB(this.center1.sub(r), this.center1.add(r));
    return AABB.surrounding(box0, box1);
  }
}
