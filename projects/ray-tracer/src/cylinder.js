// cylinder.js — Cylinder, Disk, and Cone primitives

import { Vec3 } from './vec3.js';
import { HitRecord } from './hittable.js';
import { AABB } from './aabb.js';

// Disk — flat circular area at y=k with given radius
export class Disk {
  constructor(center, normal, radius, material) {
    this.center = center;
    this.normal = normal.unit();
    this.radius = radius;
    this.material = material;
  }

  hit(ray, tMin, tMax) {
    const denom = this.normal.dot(ray.direction);
    if (Math.abs(denom) < 1e-8) return null;

    const t = this.center.sub(ray.origin).dot(this.normal) / denom;
    if (t < tMin || t > tMax) return null;

    const p = ray.at(t);
    if (p.sub(this.center).lengthSquared() > this.radius * this.radius) return null;

    const rec = new HitRecord();
    rec.t = t;
    rec.p = p;
    rec.setFaceNormal(ray, this.normal);
    rec.material = this.material;
    return rec;
  }

  boundingBox() {
    const r = this.radius;
    return new AABB(
      this.center.sub(new Vec3(r, r, r)),
      this.center.add(new Vec3(r, r, r))
    );
  }
}

// Cylinder along Y axis from y0 to y1
export class Cylinder {
  constructor(center, radius, y0, y1, material) {
    this.center = center; // x, z center
    this.radius = radius;
    this.y0 = y0;
    this.y1 = y1;
    this.material = material;
  }

  hit(ray, tMin, tMax) {
    // Solve ray-cylinder intersection in xz plane
    const ox = ray.origin.x - this.center.x;
    const oz = ray.origin.z - this.center.z;
    const dx = ray.direction.x;
    const dz = ray.direction.z;

    const a = dx * dx + dz * dz;
    const b = 2 * (ox * dx + oz * dz);
    const c = ox * ox + oz * oz - this.radius * this.radius;

    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    let closestRec = null;

    // Check both roots
    for (const sign of [-1, 1]) {
      const t = (-b + sign * sqrtDisc) / (2 * a);
      if (t < tMin || t > tMax) continue;
      if (closestRec && t >= closestRec.t) continue;

      const y = ray.origin.y + t * ray.direction.y;
      if (y < this.y0 || y > this.y1) continue;

      const p = ray.at(t);
      const rec = new HitRecord();
      rec.t = t;
      rec.p = p;
      const outwardNormal = new Vec3(p.x - this.center.x, 0, p.z - this.center.z).div(this.radius);
      rec.setFaceNormal(ray, outwardNormal);
      rec.material = this.material;
      closestRec = rec;
    }

    return closestRec;
  }

  boundingBox() {
    return new AABB(
      new Vec3(this.center.x - this.radius, this.y0, this.center.z - this.radius),
      new Vec3(this.center.x + this.radius, this.y1, this.center.z + this.radius)
    );
  }
}

// Cone along Y axis from y0 (base) to y1 (tip)
export class Cone {
  constructor(tip, radius, height, material) {
    this.tip = tip; // Top point
    this.radius = radius; // Base radius
    this.height = height;
    this.material = material;
    this.baseY = tip.y - height;
  }

  hit(ray, tMin, tMax) {
    const ox = ray.origin.x - this.tip.x;
    const oy = ray.origin.y - this.tip.y;
    const oz = ray.origin.z - this.tip.z;
    const dx = ray.direction.x;
    const dy = ray.direction.y;
    const dz = ray.direction.z;

    const k = (this.radius / this.height) ** 2;

    const a = dx * dx + dz * dz - k * dy * dy;
    const b = 2 * (ox * dx + oz * dz - k * oy * dy);
    const c = ox * ox + oz * oz - k * oy * oy;

    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    let closestRec = null;

    for (const sign of [-1, 1]) {
      const t = (-b + sign * sqrtDisc) / (2 * a);
      if (t < tMin || t > tMax) continue;
      if (closestRec && t >= closestRec.t) continue;

      const y = ray.origin.y + t * ray.direction.y;
      if (y > this.tip.y || y < this.baseY) continue;

      const p = ray.at(t);
      const rec = new HitRecord();
      rec.t = t;
      rec.p = p;
      // Normal for cone
      const dist = Math.sqrt((p.x - this.tip.x) ** 2 + (p.z - this.tip.z) ** 2);
      const normalY = dist * (this.radius / this.height);
      const outwardNormal = new Vec3(p.x - this.tip.x, normalY, p.z - this.tip.z).unit();
      rec.setFaceNormal(ray, outwardNormal);
      rec.material = this.material;
      closestRec = rec;
    }

    return closestRec;
  }

  boundingBox() {
    return new AABB(
      new Vec3(this.tip.x - this.radius, this.baseY, this.tip.z - this.radius),
      new Vec3(this.tip.x + this.radius, this.tip.y, this.tip.z + this.radius)
    );
  }
}
