// ray.js — A ray is a line: P(t) = origin + t * direction

import { Vec3 } from './vec3.js';

export class Ray {
  constructor(origin, direction) {
    this.origin = origin;
    this.direction = direction;
  }

  at(t) {
    return this.origin.add(this.direction.mul(t));
  }
}
