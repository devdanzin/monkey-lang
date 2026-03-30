// bundle.js — Single-file browser bundle of the ray tracer
// Auto-generated from src/ modules — includes BVH, textures, emissive, planes, triangles

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

// ===== AABB =====
class AABB {
  constructor(minimum, maximum) { this.minimum = minimum; this.maximum = maximum; }
  hit(ray, tMin, tMax) {
    const ox = ray.origin.x, oy = ray.origin.y, oz = ray.origin.z;
    const dx = ray.direction.x, dy = ray.direction.y, dz = ray.direction.z;
    let invD, t0, t1;
    invD = 1.0 / dx;
    t0 = (this.minimum.x - ox) * invD; t1 = (this.maximum.x - ox) * invD;
    if (invD < 0) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tMin) tMin = t0; if (t1 < tMax) tMax = t1; if (tMax <= tMin) return false;
    invD = 1.0 / dy;
    t0 = (this.minimum.y - oy) * invD; t1 = (this.maximum.y - oy) * invD;
    if (invD < 0) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tMin) tMin = t0; if (t1 < tMax) tMax = t1; if (tMax <= tMin) return false;
    invD = 1.0 / dz;
    t0 = (this.minimum.z - oz) * invD; t1 = (this.maximum.z - oz) * invD;
    if (invD < 0) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tMin) tMin = t0; if (t1 < tMax) tMax = t1; if (tMax <= tMin) return false;
    return true;
  }
  static surrounding(a, b) {
    return new AABB(
      new Vec3(Math.min(a.minimum.x, b.minimum.x), Math.min(a.minimum.y, b.minimum.y), Math.min(a.minimum.z, b.minimum.z)),
      new Vec3(Math.max(a.maximum.x, b.maximum.x), Math.max(a.maximum.y, b.maximum.y), Math.max(a.maximum.z, b.maximum.z))
    );
  }
}

// ===== BVH =====
class BVHNode {
  constructor(objects, start = 0, end = objects.length) {
    const span = end - start;
    if (span === 1) { this.left = this.right = objects[start]; }
    else if (span === 2) { this.left = objects[start]; this.right = objects[start + 1]; }
    else {
      const axis = Math.floor(Math.random() * 3);
      const comp = axis === 0 ? 'x' : axis === 1 ? 'y' : 'z';
      const slice = objects.slice(start, end);
      slice.sort((a, b) => {
        const ba = a.boundingBox && a.boundingBox(), bb = b.boundingBox && b.boundingBox();
        if (!ba || !bb) return 0;
        return ba.minimum[comp] - bb.minimum[comp];
      });
      for (let i = 0; i < slice.length; i++) objects[start + i] = slice[i];
      const mid = start + Math.floor(span / 2);
      this.left = new BVHNode(objects, start, mid);
      this.right = new BVHNode(objects, mid, end);
    }
    const bl = this.left.boundingBox ? this.left.boundingBox() : null;
    const br = this.right.boundingBox ? this.right.boundingBox() : null;
    this.box = bl && br ? AABB.surrounding(bl, br) : (bl || br || null);
  }
  hit(ray, tMin, tMax) {
    if (!this.box || !this.box.hit(ray, tMin, tMax)) return null;
    const hl = this.left.hit(ray, tMin, tMax);
    const hr = this.right.hit(ray, tMin, hl ? hl.t : tMax);
    return hr || hl;
  }
  boundingBox() { return this.box; }
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
  boundingBox() {
    const r = new Vec3(this.radius, this.radius, this.radius);
    return new AABB(this.center.sub(r), this.center.add(r));
  }
}

// ===== XZRect (for area lights) =====
class XZRect {
  constructor(x0, x1, z0, z1, k, material) {
    this.x0 = x0; this.x1 = x1; this.z0 = z0; this.z1 = z1; this.k = k; this.material = material;
  }
  hit(ray, tMin, tMax) {
    const t = (this.k - ray.origin.y) / ray.direction.y;
    if (t < tMin || t > tMax) return null;
    const x = ray.origin.x + t * ray.direction.x;
    const z = ray.origin.z + t * ray.direction.z;
    if (x < this.x0 || x > this.x1 || z < this.z0 || z > this.z1) return null;
    const rec = new HitRecord();
    rec.t = t; rec.p = ray.at(t);
    rec.setFaceNormal(ray, new Vec3(0, 1, 0));
    rec.material = this.material;
    return rec;
  }
  boundingBox() {
    return new AABB(new Vec3(this.x0, this.k - 0.0001, this.z0), new Vec3(this.x1, this.k + 0.0001, this.z1));
  }
}

// ===== Textures =====
class SolidColor {
  constructor(color) { this.color = color; }
  value(u, v, p) { return this.color; }
}

class CheckerTexture {
  constructor(even, odd, scale = 10) {
    this.even = even instanceof Vec3 ? new SolidColor(even) : even;
    this.odd = odd instanceof Vec3 ? new SolidColor(odd) : odd;
    this.scale = scale;
  }
  value(u, v, p) {
    const s = Math.sin(this.scale * p.x) * Math.sin(this.scale * p.y) * Math.sin(this.scale * p.z);
    return s < 0 ? this.odd.value(u, v, p) : this.even.value(u, v, p);
  }
}

// ===== Materials =====
class Lambertian {
  constructor(albedo) {
    this.texture = albedo instanceof Vec3 ? new SolidColor(albedo) : albedo;
    this.albedo = albedo instanceof Vec3 ? albedo : null;
  }
  scatter(rayIn, rec) {
    let dir = rec.normal.add(Vec3.randomUnitVector());
    if (dir.nearZero()) dir = rec.normal;
    return { scattered: new Ray(rec.p, dir), attenuation: this.texture.value(0, 0, rec.p) };
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

class DiffuseLight {
  constructor(emit) { this.emit = emit; }
  scatter() { return null; }
  emitted(u, v, p) { return this.emit; }
}

// ===== Camera =====
class Camera {
  constructor({ lookFrom, lookAt, vup, vfov = 90, aspectRatio = 16/9, aperture = 0, focusDist = 1 } = {}) {
    lookFrom = lookFrom ? new Vec3(lookFrom.x, lookFrom.y, lookFrom.z) : new Vec3(0, 0, 0);
    lookAt = lookAt ? new Vec3(lookAt.x, lookAt.y, lookAt.z) : new Vec3(0, 0, -1);
    vup = vup ? new Vec3(vup.x, vup.y, vup.z) : new Vec3(0, 1, 0);
    const theta = vfov * Math.PI / 180, h = Math.tan(theta / 2);
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
  world.add(new Sphere(new Vec3(0, -1000, 0), 1000, new Lambertian(new CheckerTexture(new Vec3(0.2, 0.3, 0.1), new Vec3(0.9, 0.9, 0.9)))));
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
  const R = 1000;
  world.add(new Sphere(new Vec3(0, 0, -(R + 2)), R, new Lambertian(new Vec3(0.73, 0.73, 0.73))));
  world.add(new Sphere(new Vec3(0, -(R + 1), 0), R, new Lambertian(new Vec3(0.73, 0.73, 0.73))));
  world.add(new Sphere(new Vec3(0, R + 3, 0), R, new Lambertian(new Vec3(0.73, 0.73, 0.73))));
  world.add(new Sphere(new Vec3(-(R + 2), 0, 0), R, new Lambertian(new Vec3(0.12, 0.45, 0.15))));
  world.add(new Sphere(new Vec3(R + 2, 0, 0), R, new Lambertian(new Vec3(0.65, 0.05, 0.05))));
  world.add(new Sphere(new Vec3(-0.5, -0.3, -1.2), 0.7, new Lambertian(new Vec3(0.73, 0.73, 0.73))));
  world.add(new Sphere(new Vec3(0.7, -0.6, -0.8), 0.4, new Metal(new Vec3(0.9, 0.9, 0.9), 0.0)));
  world.add(new Sphere(new Vec3(0.2, -0.7, -0.3), 0.3, new Dielectric(1.5)));
  return world;
}

function createGlassStudy() {
  const world = new HittableList();
  world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new CheckerTexture(new Vec3(0.1, 0.2, 0.1), new Vec3(0.9, 0.9, 0.9), 15))));
  world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Dielectric(1.5)));
  world.add(new Sphere(new Vec3(0, 0, -1), -0.45, new Dielectric(1.5)));
  world.add(new Sphere(new Vec3(-1.2, 0, -1), 0.5, new Dielectric(1.33)));
  world.add(new Sphere(new Vec3(1.2, 0, -1), 0.5, new Dielectric(2.42)));
  world.add(new Sphere(new Vec3(0, 0, -3), 1.0, new Lambertian(new Vec3(0.8, 0.2, 0.2))));
  world.add(new Sphere(new Vec3(-2, 0.5, -2), 0.8, new Lambertian(new Vec3(0.2, 0.2, 0.8))));
  world.add(new Sphere(new Vec3(2, 0.3, -2.5), 0.6, new Metal(new Vec3(0.9, 0.8, 0.5), 0.1)));
  return world;
}

function createMetalShowcase() {
  const world = new HittableList();
  world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Vec3(0.3, 0.3, 0.3))));
  for (let i = 0; i < 5; i++) {
    const fuzz = i * 0.25;
    const x = (i - 2) * 1.2;
    const hue = i / 5;
    const r = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + 0.0));
    const g = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + 0.33));
    const b = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + 0.67));
    world.add(new Sphere(new Vec3(x, 0, -1.5), 0.5, new Metal(new Vec3(r, g, b), fuzz)));
  }
  world.add(new Sphere(new Vec3(0, 1.5, -4), 2.0, new Metal(new Vec3(0.95, 0.95, 0.95), 0.0)));
  world.add(new Sphere(new Vec3(0, 0.3, 0), 0.3, new Dielectric(1.5)));
  return world;
}

function createLitRoom() {
  const world = new HittableList();
  // Floor with checker
  world.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new CheckerTexture(new Vec3(0.05, 0.05, 0.05), new Vec3(0.95, 0.95, 0.95), 8))));
  // Objects
  world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Vec3(0.7, 0.3, 0.3))));
  world.add(new Sphere(new Vec3(-1.2, 0, -1), 0.5, new Metal(new Vec3(0.8, 0.8, 0.8), 0.05)));
  world.add(new Sphere(new Vec3(1.2, 0, -1), 0.5, new Dielectric(1.5)));
  // Area light above
  world.add(new XZRect(-2, 2, -3, 1, 3, new DiffuseLight(new Vec3(7, 7, 7))));
  // Small light sphere
  world.add(new Sphere(new Vec3(0, 5, -1), 1, new DiffuseLight(new Vec3(4, 4, 4))));
  return world;
}

// ===== Expose to global =====
if (typeof self !== 'undefined') {
  self.RayTracer = {
    Vec3, Ray, HitRecord, HittableList, AABB, BVHNode, Sphere, XZRect,
    SolidColor, CheckerTexture,
    Lambertian, Metal, Dielectric, DiffuseLight, Camera,
    createRandomScene, createSimpleScene, createCornellBox,
    createGlassStudy, createMetalShowcase, createLitRoom
  };
}
