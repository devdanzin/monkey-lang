// vec3.js — 3D vector math library
// Used for positions, directions, and colors (RGB)

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  // Arithmetic
  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(t) {
    if (t instanceof Vec3) return new Vec3(this.x * t.x, this.y * t.y, this.z * t.z);
    return new Vec3(this.x * t, this.y * t, this.z * t);
  }
  div(t) { return new Vec3(this.x / t, this.y / t, this.z / t); }
  negate() { return new Vec3(-this.x, -this.y, -this.z); }

  // Dot and cross products
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  // Length
  lengthSquared() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.sqrt(this.lengthSquared()); }

  // Normalization
  unit() {
    const len = this.length();
    return len > 0 ? this.div(len) : new Vec3(0, 0, 0);
  }

  // Near zero check (for degenerate scatter directions)
  nearZero() {
    const s = 1e-8;
    return Math.abs(this.x) < s && Math.abs(this.y) < s && Math.abs(this.z) < s;
  }

  // Reflection: v - 2*dot(v,n)*n
  reflect(n) {
    return this.sub(n.mul(2 * this.dot(n)));
  }

  // Refraction (Snell's law)
  refract(n, etaiOverEtat) {
    const cosTheta = Math.min(this.negate().dot(n), 1.0);
    const rOutPerp = this.add(n.mul(cosTheta)).mul(etaiOverEtat);
    const rOutParallel = n.mul(-Math.sqrt(Math.abs(1.0 - rOutPerp.lengthSquared())));
    return rOutPerp.add(rOutParallel);
  }

  // Clamp each component
  clamp(min, max) {
    return new Vec3(
      Math.max(min, Math.min(max, this.x)),
      Math.max(min, Math.min(max, this.y)),
      Math.max(min, Math.min(max, this.z))
    );
  }

  // Linear interpolation
  lerp(v, t) {
    return this.mul(1 - t).add(v.mul(t));
  }

  toString() { return `Vec3(${this.x.toFixed(4)}, ${this.y.toFixed(4)}, ${this.z.toFixed(4)})`; }

  // Static constructors
  static zero() { return new Vec3(0, 0, 0); }
  static one() { return new Vec3(1, 1, 1); }
  static random(min = 0, max = 1) {
    return new Vec3(
      min + Math.random() * (max - min),
      min + Math.random() * (max - min),
      min + Math.random() * (max - min)
    );
  }
  static randomInUnitSphere() {
    while (true) {
      const p = Vec3.random(-1, 1);
      if (p.lengthSquared() < 1) return p;
    }
  }
  static randomUnitVector() {
    return Vec3.randomInUnitSphere().unit();
  }
  static randomInHemisphere(normal) {
    const inSphere = Vec3.randomInUnitSphere();
    return inSphere.dot(normal) > 0 ? inSphere : inSphere.negate();
  }
  static randomInUnitDisk() {
    while (true) {
      const p = new Vec3(-1 + 2 * Math.random(), -1 + 2 * Math.random(), 0);
      if (p.lengthSquared() < 1) return p;
    }
  }
}

// Aliases for readability
export const Point3 = Vec3;
export const Color = Vec3;
