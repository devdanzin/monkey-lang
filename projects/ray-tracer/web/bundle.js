// bundle.js — Single-file browser bundle of the ray tracer
// Auto-generated from src/ modules

// ===== Vec3 =====
class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(t) {
    if (t instanceof Vec3) return new Vec3(this.x * t.x, this.y * t.y, this.z * t.z);
    return new Vec3(this.x * t, this.y * t, this.z * t);
  }
  div(t) { return new Vec3(this.x / t, this.y / t, this.z / t); }
  negate() { return new Vec3(-this.x, -this.y, -this.z); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
  }
  lengthSquared() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.sqrt(this.lengthSquared()); }
  unit() { const l = this.length(); return l > 0 ? this.div(l) : new Vec3(); }
  nearZero() { const s = 1e-8; return Math.abs(this.x) < s && Math.abs(this.y) < s && Math.abs(this.z) < s; }
  reflect(n) { return this.sub(n.mul(2 * this.dot(n))); }
  refract(n, etaiOverEtat) {
    const cosTheta = Math.min(this.negate().dot(n), 1.0);
    const rOutPerp = this.add(n.mul(cosTheta)).mul(etaiOverEtat);
    const rOutParallel = n.mul(-Math.sqrt(Math.abs(1.0 - rOutPerp.lengthSquared())));
    return rOutPerp.add(rOutParallel);
  }
  static random(min = 0, max = 1) {
    return new Vec3(min + Math.random() * (max - min), min + Math.random() * (max - min), min + Math.random() * (max - min));
  }
  static randomInUnitSphere() {
    while (true) { const p = Vec3.random(-1, 1); if (p.lengthSquared() < 1) return p; }
  }
  static randomUnitVector() { return Vec3.randomInUnitSphere().unit(); }
  static randomInUnitDisk() {
    while (true) { const p = new Vec3(-1 + 2 * Math.random(), -1 + 2 * Math.random(), 0); if (p.lengthSquared() < 1) return p; }
  }
}

// ===== Ray =====
class Ray {
  constructor(origin, direction) { this.origin = origin; this.direction = direction; }
  at(t) { return this.origin.add(this.direction.mul(t)); }
}

// ===== HitRecord + HittableList =====
class HitRecord {
  constructor() { this.p = null; this.normal = null; this.t = 0; this.frontFace = true; this.material = null; }
  setFaceNormal(ray, outwardNormal) {
    this.frontFace = ray.direction.dot(outwardNormal) < 0;
    this.normal = this.frontFace ? outwardNormal : outwardNormal.negate();
  }
}

class HittableList {
  constructor() { this.objects = []; }
  add(object) { this.objects.push(object); }
  hit(ray, tMin, tMax) {
    let closest = tMax, result = null;
    for (const obj of this.objects) {
      const rec = obj.hit(ray, tMin, closest);
      if (rec) { closest = rec.t; result = rec; }
    }
    return result;
  }
}

// ===== Sphere =====
class Sphere {
  constructor(center, radius, material) { this.center = center; this.radius = radius; this.material = material; }
  hit(ray, tMin, tMax) {
    const oc = ray.origin.sub(this.center);
    const a = ray.direction.lengthSquared();
    const halfB = oc.dot(ray.direction);
    const c = oc.lengthSquared() - this.radius * this.radius;
    const d = halfB * halfB - a * c;
    if (d < 0) return null;
    const sqrtd = Math.sqrt(d);
    let root = (-halfB - sqrtd) / a;
    if (root <= tMin || root >= tMax) { root = (-halfB + sqrtd) / a; if (root <= tMin || root >= tMax) return null; }
    const rec = new HitRecord();
    rec.t = root; rec.p = ray.at(root);
    rec.setFaceNormal(ray, rec.p.sub(this.center).div(this.radius));
    rec.material = this.material;
    return rec;
  }
}

// ===== Materials =====
class Lambertian {
  constructor(albedo) { this.albedo = albedo; }
  scatter(rayIn, rec) {
    let dir = rec.normal.add(Vec3.randomUnitVector());
    if (dir.nearZero()) dir = rec.normal;
    return { scattered: new Ray(rec.p, dir), attenuation: this.albedo };
  }
}

class Metal {
  constructor(albedo, fuzz = 0) { this.albedo = albedo; this.fuzz = Math.min(fuzz, 1); }
  scatter(rayIn, rec) {
    const reflected = rayIn.direction.unit().reflect(rec.normal);
    const scattered = new Ray(rec.p, reflected.add(Vec3.randomInUnitSphere().mul(this.fuzz)));
    if (scattered.direction.dot(rec.normal) <= 0) return null;
    return { scattered, attenuation: this.albedo };
  }
}

class Dielectric {
  constructor(ir) { this.ir = ir; }
  scatter(rayIn, rec) {
    const ratio = rec.frontFace ? (1.0 / this.ir) : this.ir;
    const unitDir = rayIn.direction.unit();
    const cosTheta = Math.min(unitDir.negate().dot(rec.normal), 1.0);
    const sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);
    let dir;
    if (ratio * sinTheta > 1.0 || this._reflectance(cosTheta, ratio) > Math.random()) {
      dir = unitDir.reflect(rec.normal);
    } else {
      dir = unitDir.refract(rec.normal, ratio);
    }
    return { scattered: new Ray(rec.p, dir), attenuation: new Vec3(1, 1, 1) };
  }
  _reflectance(cos, ri) { let r0 = (1 - ri) / (1 + ri); r0 *= r0; return r0 + (1 - r0) * Math.pow(1 - cos, 5); }
}

// ===== Camera =====
class Camera {
  constructor({ lookFrom, lookAt, vup, vfov = 90, aspectRatio = 16/9, aperture = 0, focusDist = 1 } = {}) {
    lookFrom = lookFrom ? new Vec3(lookFrom.x, lookFrom.y, lookFrom.z) : new Vec3(0, 0, 0);
    lookAt = lookAt ? new Vec3(lookAt.x, lookAt.y, lookAt.z) : new Vec3(0, 0, -1);
    vup = vup ? new Vec3(vup.x, vup.y, vup.z) : new Vec3(0, 1, 0);
    const theta = vfov * Math.PI / 180;
    const h = Math.tan(theta / 2);
    const vh = 2.0 * h, vw = aspectRatio * vh;
    this.w = lookFrom.sub(lookAt).unit();
    this.u = vup.cross(this.w).unit();
    this.v = this.w.cross(this.u);
    this.origin = lookFrom;
    this.horizontal = this.u.mul(vw * focusDist);
    this.vertical = this.v.mul(vh * focusDist);
    this.lowerLeftCorner = this.origin.sub(this.horizontal.div(2)).sub(this.vertical.div(2)).sub(this.w.mul(focusDist));
    this.lensRadius = aperture / 2;
  }
  getRay(s, t) {
    const rd = Vec3.randomInUnitDisk().mul(this.lensRadius);
    const offset = this.u.mul(rd.x).add(this.v.mul(rd.y));
    return new Ray(this.origin.add(offset), this.lowerLeftCorner.add(this.horizontal.mul(s)).add(this.vertical.mul(t)).sub(this.origin).sub(offset));
  }
}

// ===== Scenes =====
function createRandomScene() {
  const world = new HittableList();
  world.add(new Sphere(new Vec3(0, -1000, 0), 1000, new Lambertian(new Vec3(0.5, 0.5, 0.5))));
  for (let a = -11; a < 11; a++) {
    for (let b = -11; b < 11; b++) {
      const r = Math.random();
      const center = new Vec3(a + 0.9 * Math.random(), 0.2, b + 0.9 * Math.random());
      if (center.sub(new Vec3(4, 0.2, 0)).length() > 0.9) {
        if (r < 0.8) world.add(new Sphere(center, 0.2, new Lambertian(Vec3.random().mul(Vec3.random()))));
        else if (r < 0.95) world.add(new Sphere(center, 0.2, new Metal(Vec3.random(0.5, 1), Math.random() * 0.5)));
        else world.add(new Sphere(center, 0.2, new Dielectric(1.5)));
      }
    }
  }
  world.add(new Sphere(new Vec3(0, 1, 0), 1.0, new Dielectric(1.5)));
  world.add(new Sphere(new Vec3(-4, 1, 0), 1.0, new Lambertian(new Vec3(0.4, 0.2, 0.1))));
  world.add(new Sphere(new Vec3(4, 1, 0), 1.0, new Metal(new Vec3(0.7, 0.6, 0.5), 0.0)));
  return world;
}

function createSimpleScene() {
  const world = new HittableList();
  world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Vec3(0.8, 0.8, 0.0))));
  world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Vec3(0.1, 0.2, 0.5))));
  world.add(new Sphere(new Vec3(-1, 0, -1), 0.5, new Dielectric(1.5)));
  world.add(new Sphere(new Vec3(-1, 0, -1), -0.4, new Dielectric(1.5)));
  world.add(new Sphere(new Vec3(1, 0, -1), 0.5, new Metal(new Vec3(0.8, 0.6, 0.2), 0.0)));
  return world;
}

function createCornellBox() {
  const world = new HittableList();
  // Walls (large spheres approximate planes)
  const R = 1000;
  world.add(new Sphere(new Vec3(0, 0, -(R + 2)), R, new Lambertian(new Vec3(0.73, 0.73, 0.73)))); // back
  world.add(new Sphere(new Vec3(0, -(R + 1), 0), R, new Lambertian(new Vec3(0.73, 0.73, 0.73)))); // floor
  world.add(new Sphere(new Vec3(0, R + 3, 0), R, new Lambertian(new Vec3(0.73, 0.73, 0.73))));     // ceiling
  world.add(new Sphere(new Vec3(-(R + 2), 0, 0), R, new Lambertian(new Vec3(0.12, 0.45, 0.15)))); // left green
  world.add(new Sphere(new Vec3(R + 2, 0, 0), R, new Lambertian(new Vec3(0.65, 0.05, 0.05))));    // right red
  // Objects
  world.add(new Sphere(new Vec3(-0.5, -0.3, -1.2), 0.7, new Lambertian(new Vec3(0.73, 0.73, 0.73))));
  world.add(new Sphere(new Vec3(0.7, -0.6, -0.8), 0.4, new Metal(new Vec3(0.9, 0.9, 0.9), 0.0)));
  world.add(new Sphere(new Vec3(0.2, -0.7, -0.3), 0.3, new Dielectric(1.5)));
  return world;
}

function createGlassStudy() {
  const world = new HittableList();
  // Ground — checkered effect via two-tone
  world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Vec3(0.2, 0.3, 0.1))));
  // Center: solid glass sphere
  world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Dielectric(1.5)));
  // Center: hollow glass (negative radius inner sphere)
  world.add(new Sphere(new Vec3(0, 0, -1), -0.45, new Dielectric(1.5)));
  // Left: water sphere (lower IOR)
  world.add(new Sphere(new Vec3(-1.2, 0, -1), 0.5, new Dielectric(1.33)));
  // Right: diamond (high IOR)
  world.add(new Sphere(new Vec3(1.2, 0, -1), 0.5, new Dielectric(2.42)));
  // Behind: colored matte sphere visible through glass
  world.add(new Sphere(new Vec3(0, 0, -3), 1.0, new Lambertian(new Vec3(0.8, 0.2, 0.2))));
  world.add(new Sphere(new Vec3(-2, 0.5, -2), 0.8, new Lambertian(new Vec3(0.2, 0.2, 0.8))));
  world.add(new Sphere(new Vec3(2, 0.3, -2.5), 0.6, new Metal(new Vec3(0.9, 0.8, 0.5), 0.1)));
  return world;
}

function createMetalShowcase() {
  const world = new HittableList();
  world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Vec3(0.3, 0.3, 0.3))));
  // Row of metals with increasing fuzz
  for (let i = 0; i < 5; i++) {
    const fuzz = i * 0.25;
    const x = (i - 2) * 1.2;
    const hue = i / 5;
    // HSL-ish to RGB
    const r = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + 0.0));
    const g = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + 0.33));
    const b = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + 0.67));
    world.add(new Sphere(new Vec3(x, 0, -1.5), 0.5, new Metal(new Vec3(r, g, b), fuzz)));
  }
  // Large mirror sphere behind
  world.add(new Sphere(new Vec3(0, 1.5, -4), 2.0, new Metal(new Vec3(0.95, 0.95, 0.95), 0.0)));
  // Glass accent
  world.add(new Sphere(new Vec3(0, 0.3, 0), 0.3, new Dielectric(1.5)));
  return world;
}

// ===== Expose to global =====
if (typeof self !== 'undefined') {
  self.RayTracer = {
    Vec3, Ray, HitRecord, HittableList, Sphere,
    Lambertian, Metal, Dielectric, Camera,
    createRandomScene, createSimpleScene, createCornellBox, createGlassStudy, createMetalShowcase
  };
}
