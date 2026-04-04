// vec3.js — 3D vector math for the SDF renderer

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }

  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  div(s) { return new Vec3(this.x / s, this.y / s, this.z / s); }
  neg() { return new Vec3(-this.x, -this.y, -this.z); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  length() { return Math.sqrt(this.dot(this)); }
  normalize() { const l = this.length(); return l > 0 ? this.div(l) : new Vec3(); }
  abs() { return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)); }
  max(s) { return new Vec3(Math.max(this.x, s), Math.max(this.y, s), Math.max(this.z, s)); }
  min(s) { return new Vec3(Math.min(this.x, s), Math.min(this.y, s), Math.min(this.z, s)); }
  maxV(v) { return new Vec3(Math.max(this.x, v.x), Math.max(this.y, v.y), Math.max(this.z, v.z)); }
  minV(v) { return new Vec3(Math.min(this.x, v.x), Math.min(this.y, v.y), Math.min(this.z, v.z)); }
  lerp(v, t) { return this.mul(1 - t).add(v.mul(t)); }
  reflect(n) { return this.sub(n.mul(2 * this.dot(n))); }
  maxComponent() { return Math.max(this.x, this.y, this.z); }
  clone() { return new Vec3(this.x, this.y, this.z); }

  static fromArray([x, y, z]) { return new Vec3(x, y, z); }
  toArray() { return [this.x, this.y, this.z]; }
}

export function vec3(x = 0, y = 0, z = 0) { return new Vec3(x, y, z); }
export function clamp(x, lo, hi) { return Math.min(Math.max(x, lo), hi); }
export function mix(a, b, t) { return a * (1 - t) + b * t; }
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
