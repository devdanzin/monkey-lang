// sphere.js — Ray-sphere intersection

import { HitRecord } from './hittable.js';
import { Vec3 } from './vec3.js';
import { AABB } from './aabb.js';
import { Ray } from './ray.js';

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

    // UV mapping: spherical coordinates
    // u: [0, 1] longitude, v: [0, 1] latitude
    const unitP = outwardNormal; // Already a unit vector (point - center / radius)
    const theta = Math.acos(-unitP.y);
    const phi = Math.atan2(-unitP.z, unitP.x) + Math.PI;
    rec.u = phi / (2 * Math.PI);
    rec.v = theta / Math.PI;

    return rec;
  }

  boundingBox() {
    const r = new Vec3(this.radius, this.radius, this.radius);
    return new AABB(this.center.sub(r), this.center.add(r));
  }

  /**
   * Random point on the sphere's surface.
   */
  randomPoint() {
    const dir = Vec3.randomUnitVector();
    return this.center.add(dir.mul(this.radius));
  }

  /**
   * Area of the sphere.
   */
  area() {
    return 4 * Math.PI * this.radius * this.radius;
  }

  /**
   * PDF value for sampling a direction from origin toward this sphere.
   * Uses the solid angle subtended by the sphere.
   */
  pdfValue(origin, direction) {
    const rec = this.hit(new Ray(origin, direction), 0.001, Infinity);
    if (!rec) return 0;
    const distSq = this.center.sub(origin).lengthSquared();
    const cosThetaMax = Math.sqrt(1 - this.radius * this.radius / distSq);
    if (isNaN(cosThetaMax) || cosThetaMax >= 1) return 0;
    const solidAngle = 2 * Math.PI * (1 - cosThetaMax);
    return 1 / solidAngle;
  }
}
