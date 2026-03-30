// volume.js — Constant density medium for fog/smoke/mist

import { Vec3 } from './vec3.js';
import { Ray } from './ray.js';
import { HitRecord } from './hittable.js';

// Isotropic scattering material — scatters in random direction
export class Isotropic {
  constructor(albedo) {
    this.albedo = albedo; // Color
  }

  scatter(rayIn, rec) {
    return {
      scattered: new Ray(rec.p, Vec3.randomInUnitSphere()),
      attenuation: this.albedo
    };
  }
}

// Constant density medium — a volume of fog/smoke inside a boundary object
export class ConstantMedium {
  constructor(boundary, density, color) {
    this.boundary = boundary;
    this.negInvDensity = -1.0 / density;
    this.phaseFunction = new Isotropic(color);
  }

  hit(ray, tMin, tMax) {
    // Find where ray enters and exits the boundary
    const rec1 = this.boundary.hit(ray, -Infinity, Infinity);
    if (!rec1) return null;

    const rec2 = this.boundary.hit(ray, rec1.t + 0.0001, Infinity);
    if (!rec2) return null;

    if (rec1.t < tMin) rec1.t = tMin;
    if (rec2.t > tMax) rec2.t = tMax;
    if (rec1.t >= rec2.t) return null;
    if (rec1.t < 0) rec1.t = 0;

    const rayLength = ray.direction.length();
    const distanceInsideBoundary = (rec2.t - rec1.t) * rayLength;
    const hitDistance = this.negInvDensity * Math.log(Math.random());

    if (hitDistance > distanceInsideBoundary) return null;

    const rec = new HitRecord();
    rec.t = rec1.t + hitDistance / rayLength;
    rec.p = ray.at(rec.t);
    rec.normal = new Vec3(1, 0, 0); // Arbitrary — isotropic doesn't use normal
    rec.frontFace = true;
    rec.material = this.phaseFunction;

    return rec;
  }

  boundingBox() {
    return this.boundary.boundingBox();
  }
}
