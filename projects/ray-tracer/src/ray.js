// ray.js — A ray is a line: P(t) = origin + t * direction
// Also carries a time parameter for motion blur

import { Vec3 } from './vec3.js';

export class Ray {
  constructor(origin, direction, time = 0) {
    this.origin = origin;
    this.direction = direction;
    this.time = time;
  }

  at(t) {
    return this.origin.add(this.direction.mul(t));
  }
}
