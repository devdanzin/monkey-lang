// plane.js — Infinite plane defined by a point and normal

import { HitRecord } from './hittable.js';
import { Vec3 } from './vec3.js';
import { AABB } from './aabb.js';

export class Plane {
  constructor(point, normal, material) {
    this.point = point;
    this.normal = normal.unit();
    this.material = material;
  }

  hit(ray, tMin, tMax) {
    const denom = this.normal.dot(ray.direction);
    if (Math.abs(denom) < 1e-8) return null; // Ray is parallel to plane

    const t = this.point.sub(ray.origin).dot(this.normal) / denom;
    if (t <= tMin || t >= tMax) return null;

    const rec = new HitRecord();
    rec.t = t;
    rec.p = ray.at(t);
    rec.setFaceNormal(ray, this.normal);
    rec.material = this.material;

    return rec;
  }

  // Planes are infinite — no meaningful bounding box
  // BVH skips objects without bounding boxes
  boundingBox() {
    return null;
  }
}

// Axis-aligned rectangle (finite plane) for walls, floors, etc.
export class XYRect {
  constructor(x0, x1, y0, y1, k, material) {
    this.x0 = x0; this.x1 = x1;
    this.y0 = y0; this.y1 = y1;
    this.k = k;  // z position
    this.material = material;
  }

  hit(ray, tMin, tMax) {
    const t = (this.k - ray.origin.z) / ray.direction.z;
    if (t < tMin || t > tMax) return null;

    const x = ray.origin.x + t * ray.direction.x;
    const y = ray.origin.y + t * ray.direction.y;
    if (x < this.x0 || x > this.x1 || y < this.y0 || y > this.y1) return null;

    const rec = new HitRecord();
    rec.t = t;
    rec.p = ray.at(t);
    rec.setFaceNormal(ray, new Vec3(0, 0, 1));
    rec.material = this.material;
    return rec;
  }

  boundingBox() {
    return new AABB(
      new Vec3(this.x0, this.y0, this.k - 0.0001),
      new Vec3(this.x1, this.y1, this.k + 0.0001)
    );
  }
}

export class XZRect {
  constructor(x0, x1, z0, z1, k, material) {
    this.x0 = x0; this.x1 = x1;
    this.z0 = z0; this.z1 = z1;
    this.k = k;  // y position
    this.material = material;
  }

  hit(ray, tMin, tMax) {
    const t = (this.k - ray.origin.y) / ray.direction.y;
    if (t < tMin || t > tMax) return null;

    const x = ray.origin.x + t * ray.direction.x;
    const z = ray.origin.z + t * ray.direction.z;
    if (x < this.x0 || x > this.x1 || z < this.z0 || z > this.z1) return null;

    const rec = new HitRecord();
    rec.t = t;
    rec.p = ray.at(t);
    rec.setFaceNormal(ray, new Vec3(0, 1, 0));
    rec.material = this.material;
    return rec;
  }

  boundingBox() {
    return new AABB(
      new Vec3(this.x0, this.k - 0.0001, this.z0),
      new Vec3(this.x1, this.k + 0.0001, this.z1)
    );
  }
}

export class YZRect {
  constructor(y0, y1, z0, z1, k, material) {
    this.y0 = y0; this.y1 = y1;
    this.z0 = z0; this.z1 = z1;
    this.k = k;  // x position
    this.material = material;
  }

  hit(ray, tMin, tMax) {
    const t = (this.k - ray.origin.x) / ray.direction.x;
    if (t < tMin || t > tMax) return null;

    const y = ray.origin.y + t * ray.direction.y;
    const z = ray.origin.z + t * ray.direction.z;
    if (y < this.y0 || y > this.y1 || z < this.z0 || z > this.z1) return null;

    const rec = new HitRecord();
    rec.t = t;
    rec.p = ray.at(t);
    rec.setFaceNormal(ray, new Vec3(1, 0, 0));
    rec.material = this.material;
    return rec;
  }

  boundingBox() {
    return new AABB(
      new Vec3(this.k - 0.0001, this.y0, this.z0),
      new Vec3(this.k + 0.0001, this.y1, this.z1)
    );
  }
}

// Box made of 6 rectangles
export class Box {
  constructor(p0, p1, material) {
    this.p0 = p0;
    this.p1 = p1;
    this.sides = [];
    this.sides.push(new XYRect(p0.x, p1.x, p0.y, p1.y, p1.z, material));
    this.sides.push(new XYRect(p0.x, p1.x, p0.y, p1.y, p0.z, material));
    this.sides.push(new XZRect(p0.x, p1.x, p0.z, p1.z, p1.y, material));
    this.sides.push(new XZRect(p0.x, p1.x, p0.z, p1.z, p0.y, material));
    this.sides.push(new YZRect(p0.y, p1.y, p0.z, p1.z, p1.x, material));
    this.sides.push(new YZRect(p0.y, p1.y, p0.z, p1.z, p0.x, material));
  }

  hit(ray, tMin, tMax) {
    let closest = tMax;
    let result = null;
    for (const side of this.sides) {
      const rec = side.hit(ray, tMin, closest);
      if (rec) { closest = rec.t; result = rec; }
    }
    return result;
  }

  boundingBox() {
    return new AABB(this.p0, this.p1);
  }
}
