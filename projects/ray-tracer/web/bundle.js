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
  constructor(origin, direction, time = 0) { this.origin = origin; this.direction = direction; this.time = time; }
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

// ===== YZRect + XYRect (for walls) =====
class YZRect {
  constructor(y0, y1, z0, z1, k, material) {
    this.y0 = y0; this.y1 = y1; this.z0 = z0; this.z1 = z1; this.k = k; this.material = material;
  }
  hit(ray, tMin, tMax) {
    const t = (this.k - ray.origin.x) / ray.direction.x;
    if (t < tMin || t > tMax) return null;
    const y = ray.origin.y + t * ray.direction.y;
    const z = ray.origin.z + t * ray.direction.z;
    if (y < this.y0 || y > this.y1 || z < this.z0 || z > this.z1) return null;
    const rec = new HitRecord();
    rec.t = t; rec.p = ray.at(t);
    rec.setFaceNormal(ray, new Vec3(1, 0, 0));
    rec.material = this.material;
    return rec;
  }
  boundingBox() {
    return new AABB(new Vec3(this.k - 0.0001, this.y0, this.z0), new Vec3(this.k + 0.0001, this.y1, this.z1));
  }
}

class XYRect {
  constructor(x0, x1, y0, y1, k, material) {
    this.x0 = x0; this.x1 = x1; this.y0 = y0; this.y1 = y1; this.k = k; this.material = material;
  }
  hit(ray, tMin, tMax) {
    const t = (this.k - ray.origin.z) / ray.direction.z;
    if (t < tMin || t > tMax) return null;
    const x = ray.origin.x + t * ray.direction.x;
    const y = ray.origin.y + t * ray.direction.y;
    if (x < this.x0 || x > this.x1 || y < this.y0 || y > this.y1) return null;
    const rec = new HitRecord();
    rec.t = t; rec.p = ray.at(t);
    rec.setFaceNormal(ray, new Vec3(0, 0, 1));
    rec.material = this.material;
    return rec;
  }
  boundingBox() {
    return new AABB(new Vec3(this.x0, this.y0, this.k - 0.0001), new Vec3(this.x1, this.y1, this.k + 0.0001));
  }
}

// ===== Box (6 rectangles) =====
class Box {
  constructor(p0, p1, material) {
    this.p0 = p0; this.p1 = p1;
    this.sides = [
      new XYRect(p0.x, p1.x, p0.y, p1.y, p1.z, material),
      new XYRect(p0.x, p1.x, p0.y, p1.y, p0.z, material),
      new XZRect(p0.x, p1.x, p0.z, p1.z, p1.y, material),
      new XZRect(p0.x, p1.x, p0.z, p1.z, p0.y, material),
      new YZRect(p0.y, p1.y, p0.z, p1.z, p1.x, material),
      new YZRect(p0.y, p1.y, p0.z, p1.z, p0.x, material),
    ];
  }
  hit(ray, tMin, tMax) {
    let closest = tMax, result = null;
    for (const s of this.sides) {
      const rec = s.hit(ray, tMin, closest);
      if (rec) { closest = rec.t; result = rec; }
    }
    return result;
  }
  boundingBox() { return new AABB(this.p0, this.p1); }
}

// ===== Transforms =====
class Translate {
  constructor(object, offset) { this.object = object; this.offset = offset; }
  hit(ray, tMin, tMax) {
    const movedRay = new Ray(ray.origin.sub(this.offset), ray.direction);
    const rec = this.object.hit(movedRay, tMin, tMax);
    if (!rec) return null;
    rec.p = rec.p.add(this.offset);
    rec.setFaceNormal(movedRay, rec.normal);
    return rec;
  }
  boundingBox() {
    const box = this.object.boundingBox();
    if (!box) return null;
    return new AABB(box.minimum.add(this.offset), box.maximum.add(this.offset));
  }
}

class RotateY {
  constructor(object, angle) {
    this.object = object;
    const rad = angle * Math.PI / 180;
    this.sinT = Math.sin(rad); this.cosT = Math.cos(rad);
    const box = object.boundingBox();
    if (box) {
      let mn = new Vec3(Infinity, Infinity, Infinity), mx = new Vec3(-Infinity, -Infinity, -Infinity);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
        const x = i ? box.maximum.x : box.minimum.x;
        const y = j ? box.maximum.y : box.minimum.y;
        const z = k ? box.maximum.z : box.minimum.z;
        const nx = this.cosT * x + this.sinT * z;
        const nz = -this.sinT * x + this.cosT * z;
        mn = new Vec3(Math.min(mn.x, nx), Math.min(mn.y, y), Math.min(mn.z, nz));
        mx = new Vec3(Math.max(mx.x, nx), Math.max(mx.y, y), Math.max(mx.z, nz));
      }
      this.box = new AABB(mn, mx);
    } else this.box = null;
  }
  hit(ray, tMin, tMax) {
    const o = new Vec3(this.cosT*ray.origin.x - this.sinT*ray.origin.z, ray.origin.y, this.sinT*ray.origin.x + this.cosT*ray.origin.z);
    const d = new Vec3(this.cosT*ray.direction.x - this.sinT*ray.direction.z, ray.direction.y, this.sinT*ray.direction.x + this.cosT*ray.direction.z);
    const rec = this.object.hit(new Ray(o, d), tMin, tMax);
    if (!rec) return null;
    rec.p = new Vec3(this.cosT*rec.p.x + this.sinT*rec.p.z, rec.p.y, -this.sinT*rec.p.x + this.cosT*rec.p.z);
    const n = new Vec3(this.cosT*rec.normal.x + this.sinT*rec.normal.z, rec.normal.y, -this.sinT*rec.normal.x + this.cosT*rec.normal.z);
    rec.setFaceNormal(new Ray(o, d), n);
    return rec;
  }
  boundingBox() { return this.box; }
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

class NoiseTexture {
  constructor(color, scale = 4) {
    this.color = color || new Vec3(1, 1, 1);
    this.scale = scale;
    this._perm = [];
    for (let i = 0; i < 256; i++) this._perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._perm[i], this._perm[j]] = [this._perm[j], this._perm[i]];
    }
    this._perm = [...this._perm, ...this._perm];
  }
  _noise(x, y, z) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y), zf = z - Math.floor(z);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const p = this._perm;
    const aaa = p[p[p[xi]+yi]+zi]/255, aba = p[p[p[xi]+yi+1]+zi]/255;
    const aab = p[p[p[xi]+yi]+zi+1]/255, abb = p[p[p[xi]+yi+1]+zi+1]/255;
    const baa = p[p[p[xi+1]+yi]+zi]/255, bba = p[p[p[xi+1]+yi+1]+zi]/255;
    const bab = p[p[p[xi+1]+yi]+zi+1]/255, bbb = p[p[p[xi+1]+yi+1]+zi+1]/255;
    const x1 = aaa*(1-u)+baa*u, x2 = aba*(1-u)+bba*u;
    const x3 = aab*(1-u)+bab*u, x4 = abb*(1-u)+bbb*u;
    const y1 = x1*(1-v)+x2*v, y2 = x3*(1-v)+x4*v;
    return y1*(1-w)+y2*w;
  }
  _turbulence(p, depth = 7) {
    let accum = 0, weight = 1, temp = p;
    for (let i = 0; i < depth; i++) {
      accum += weight * this._noise(temp.x, temp.y, temp.z);
      weight *= 0.5; temp = temp.mul(2);
    }
    return Math.abs(accum);
  }
  value(u, v, p) {
    return this.color.mul(this._turbulence(p.mul(this.scale)));
  }
}

class MarbleTexture {
  constructor(color, scale = 4) {
    this.noise = new NoiseTexture(null, 1);
    this.scale = scale;
    this.color = color || new Vec3(1, 1, 1);
  }
  value(u, v, p) {
    return this.color.mul(0.5 * (1 + Math.sin(this.scale * p.z + 10 * this.noise._turbulence(p))));
  }
}

class StripeTexture {
  constructor(colors, scale = 10) { this.colors = colors; this.scale = scale; }
  value(u, v, p) {
    const t = (Math.sin(this.scale * p.y) + 1) * 0.5;
    return this.colors[Math.floor(t * this.colors.length) % this.colors.length];
  }
}

class PlanetTexture {
  constructor(land, ocean, cloud, scale = 3) {
    this.land = land; this.ocean = ocean; this.cloud = cloud; this.scale = scale;
    this.noise = new NoiseTexture(null, 1);
  }
  value(u, v, p) {
    const elev = this.noise._turbulence(p.mul(this.scale));
    if (this.cloud) {
      const cn = this.noise._noise(p.x*5+100, p.y*5, p.z*5);
      if (cn > 0.55) return this.cloud;
    }
    if (elev > 0.5) return this.land.mul(0.6 + elev * 0.4);
    return this.ocean.mul(0.7 + (0.5 - (0.5 - elev) * 2) * 0.3 + 0.3);
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

class ColoredGlass {
  constructor(ir, color, density = 1.0) { this.ir = ir; this.color = color; this.density = density; }
  scatter(rayIn, rec) {
    const ratio = rec.frontFace ? (1.0/this.ir) : this.ir;
    const ud = rayIn.direction.unit();
    const cos = Math.min(ud.negate().dot(rec.normal), 1.0);
    const sin = Math.sqrt(1.0 - cos*cos);
    let r0 = (1-ratio)/(1+ratio); r0*=r0;
    const refl = r0 + (1-r0)*Math.pow(1-cos,5);
    if (ratio*sin > 1.0 || refl > Math.random()) {
      return { scattered: new Ray(rec.p, ud.reflect(rec.normal)), attenuation: new Vec3(1,1,1) };
    }
    const dir = ud.refract(rec.normal, ratio);
    const att = rec.frontFace ? new Vec3(1,1,1) : new Vec3(
      Math.exp(-this.density*(1-this.color.x)*rec.t),
      Math.exp(-this.density*(1-this.color.y)*rec.t),
      Math.exp(-this.density*(1-this.color.z)*rec.t));
    return { scattered: new Ray(rec.p, dir, rayIn.time), attenuation: att };
  }
}

// ===== Cylinder/Disk/Cone =====
class Disk {
  constructor(center, normal, radius, material) { this.center = center; this.normal = normal.unit(); this.radius = radius; this.material = material; }
  hit(ray, tMin, tMax) {
    const d = this.normal.dot(ray.direction);
    if (Math.abs(d) < 1e-8) return null;
    const t = this.center.sub(ray.origin).dot(this.normal) / d;
    if (t < tMin || t > tMax) return null;
    const p = ray.at(t);
    if (p.sub(this.center).lengthSquared() > this.radius*this.radius) return null;
    const rec = new HitRecord();
    rec.t = t; rec.p = p; rec.setFaceNormal(ray, this.normal); rec.material = this.material;
    return rec;
  }
  boundingBox() { const r = this.radius; return new AABB(this.center.sub(new Vec3(r,r,r)), this.center.add(new Vec3(r,r,r))); }
}

class Cylinder {
  constructor(center, radius, y0, y1, material) { this.center = center; this.radius = radius; this.y0 = y0; this.y1 = y1; this.material = material; }
  hit(ray, tMin, tMax) {
    const ox = ray.origin.x-this.center.x, oz = ray.origin.z-this.center.z;
    const dx = ray.direction.x, dz = ray.direction.z;
    const a = dx*dx+dz*dz, b = 2*(ox*dx+oz*dz), c = ox*ox+oz*oz-this.radius*this.radius;
    const disc = b*b-4*a*c; if (disc < 0) return null;
    const sq = Math.sqrt(disc); let best = null;
    for (const s of [-1,1]) {
      const t = (-b+s*sq)/(2*a);
      if (t < tMin || t > tMax || (best && t >= best.t)) continue;
      const y = ray.origin.y+t*ray.direction.y;
      if (y < this.y0 || y > this.y1) continue;
      const p = ray.at(t);
      const rec = new HitRecord(); rec.t = t; rec.p = p;
      rec.setFaceNormal(ray, new Vec3(p.x-this.center.x, 0, p.z-this.center.z).div(this.radius));
      rec.material = this.material; best = rec;
    }
    return best;
  }
  boundingBox() { return new AABB(new Vec3(this.center.x-this.radius, this.y0, this.center.z-this.radius), new Vec3(this.center.x+this.radius, this.y1, this.center.z+this.radius)); }
}

// ===== Camera =====
class Camera {
  constructor({ lookFrom, lookAt, vup, vfov = 90, aspectRatio = 16/9, aperture = 0, focusDist = 1, time0 = 0, time1 = 0 } = {}) {
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
    this.time0 = time0; this.time1 = time1;
  }
  getRay(s, t) {
    const rd = Vec3.randomInUnitDisk().mul(this.lensRadius);
    const offset = this.u.mul(rd.x).add(this.v.mul(rd.y));
    const time = this.time0 + Math.random() * (this.time1 - this.time0);
    return new Ray(this.origin.add(offset), this.lowerLeftCorner.add(this.horizontal.mul(s)).add(this.vertical.mul(t)).sub(this.origin).sub(offset), time);
  }
}

// ===== MovingSphere =====
class MovingSphere {
  constructor(c0, c1, t0, t1, radius, material) {
    this.c0 = c0; this.c1 = c1; this.t0 = t0; this.t1 = t1;
    this.radius = radius; this.material = material;
  }
  center(time) {
    const t = (time - this.t0) / (this.t1 - this.t0);
    return this.c0.add(this.c1.sub(this.c0).mul(t));
  }
  hit(ray, tMin, tMax) {
    const cc = this.center(ray.time || 0);
    const oc = ray.origin.sub(cc);
    const a = ray.direction.lengthSquared();
    const hb = oc.dot(ray.direction);
    const c = oc.lengthSquared() - this.radius * this.radius;
    const d = hb * hb - a * c;
    if (d < 0) return null;
    const sqrtd = Math.sqrt(d);
    let root = (-hb - sqrtd) / a;
    if (root <= tMin || root >= tMax) { root = (-hb + sqrtd) / a; if (root <= tMin || root >= tMax) return null; }
    const rec = new HitRecord();
    rec.t = root; rec.p = ray.at(root);
    rec.setFaceNormal(ray, rec.p.sub(cc).div(this.radius));
    rec.material = this.material;
    return rec;
  }
  boundingBox() {
    const r = new Vec3(this.radius, this.radius, this.radius);
    const b0 = new AABB(this.c0.sub(r), this.c0.add(r));
    const b1 = new AABB(this.c1.sub(r), this.c1.add(r));
    return AABB.surrounding(b0, b1);
  }
}

// ===== Volumetrics =====
class Isotropic {
  constructor(albedo) { this.albedo = albedo; }
  scatter(rayIn, rec) {
    return { scattered: new Ray(rec.p, Vec3.randomInUnitSphere()), attenuation: this.albedo };
  }
}

class ConstantMedium {
  constructor(boundary, density, color) {
    this.boundary = boundary;
    this.negInvDensity = -1.0 / density;
    this.phaseFunction = new Isotropic(color);
  }
  hit(ray, tMin, tMax) {
    const rec1 = this.boundary.hit(ray, -Infinity, Infinity);
    if (!rec1) return null;
    const rec2 = this.boundary.hit(ray, rec1.t + 0.0001, Infinity);
    if (!rec2) return null;
    if (rec1.t < tMin) rec1.t = tMin;
    if (rec2.t > tMax) rec2.t = tMax;
    if (rec1.t >= rec2.t) return null;
    if (rec1.t < 0) rec1.t = 0;
    const rayLength = ray.direction.length();
    const distInside = (rec2.t - rec1.t) * rayLength;
    const hitDist = this.negInvDensity * Math.log(Math.random());
    if (hitDist > distInside) return null;
    const rec = new HitRecord();
    rec.t = rec1.t + hitDist / rayLength;
    rec.p = ray.at(rec.t);
    rec.normal = new Vec3(1, 0, 0);
    rec.frontFace = true;
    rec.material = this.phaseFunction;
    return rec;
  }
  boundingBox() { return this.boundary.boundingBox(); }
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
  const red   = new Lambertian(new Vec3(0.65, 0.05, 0.05));
  const white = new Lambertian(new Vec3(0.73, 0.73, 0.73));
  const green = new Lambertian(new Vec3(0.12, 0.45, 0.15));
  const light = new DiffuseLight(new Vec3(15, 15, 15));

  // Walls
  world.add(new YZRect(0, 555, 0, 555, 555, green));  // Left
  world.add(new YZRect(0, 555, 0, 555, 0, red));      // Right
  world.add(new XZRect(213, 343, 227, 332, 554, light)); // Ceiling light
  world.add(new XZRect(0, 555, 0, 555, 0, white));    // Floor
  world.add(new XZRect(0, 555, 0, 555, 555, white));  // Ceiling
  world.add(new XYRect(0, 555, 0, 555, 555, white));  // Back wall

  // Two rotated boxes
  const box1 = new Translate(new RotateY(new Box(new Vec3(0, 0, 0), new Vec3(165, 165, 165), white), -18), new Vec3(130, 0, 65));
  const box2 = new Translate(new RotateY(new Box(new Vec3(0, 0, 0), new Vec3(165, 330, 165), white), 15), new Vec3(265, 0, 295));
  world.add(box1);
  world.add(box2);

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

function createTexturedWorld() {
  const world = new HittableList();
  world.add(new Sphere(new Vec3(0, -1000, 0), 1000, new Lambertian(new CheckerTexture(new Vec3(0.2, 0.3, 0.1), new Vec3(0.9, 0.9, 0.9)))));
  world.add(new Sphere(new Vec3(0, 1, 0), 1.0, new Lambertian(new MarbleTexture(new Vec3(0.9, 0.85, 0.8), 5))));
  world.add(new Sphere(new Vec3(-2.5, 1, 0), 1.0, new Lambertian(new NoiseTexture(new Vec3(0.4, 0.6, 0.9), 6))));
  world.add(new Sphere(new Vec3(2.5, 1, 0), 1.0, new Metal(new Vec3(0.95, 0.95, 0.95), 0.0)));
  world.add(new Sphere(new Vec3(0, 0.5, 2), 0.5, new Dielectric(1.5)));
  world.add(new Sphere(new Vec3(-1.2, 0.3, 1.5), 0.3, new Lambertian(new Vec3(0.9, 0.2, 0.1))));
  world.add(new Sphere(new Vec3(1.2, 0.3, 1.5), 0.3, new Lambertian(new Vec3(0.1, 0.2, 0.9))));
  return world;
}

function createSmokyCornell() {
  const world = new HittableList();
  const red   = new Lambertian(new Vec3(0.65, 0.05, 0.05));
  const white = new Lambertian(new Vec3(0.73, 0.73, 0.73));
  const green = new Lambertian(new Vec3(0.12, 0.45, 0.15));
  const light = new DiffuseLight(new Vec3(7, 7, 7));

  world.add(new YZRect(0, 555, 0, 555, 555, green));
  world.add(new YZRect(0, 555, 0, 555, 0, red));
  world.add(new XZRect(113, 443, 127, 432, 554, light));
  world.add(new XZRect(0, 555, 0, 555, 0, white));
  world.add(new XZRect(0, 555, 0, 555, 555, white));
  world.add(new XYRect(0, 555, 0, 555, 555, white));

  const box1 = new Translate(new RotateY(new Box(new Vec3(0,0,0), new Vec3(165,165,165), white), -18), new Vec3(130,0,65));
  const box2 = new Translate(new RotateY(new Box(new Vec3(0,0,0), new Vec3(165,330,165), white), 15), new Vec3(265,0,295));

  world.add(new ConstantMedium(box1, 0.01, new Vec3(1, 1, 1)));
  world.add(new ConstantMedium(box2, 0.01, new Vec3(0, 0, 0)));

  return world;
}

function createSolarSystem() {
  const world = new HittableList();
  // Star (emissive)
  world.add(new Sphere(new Vec3(0, 0, 0), 3, new DiffuseLight(new Vec3(5, 4, 2))));
  // Earth-like planet
  world.add(new Sphere(new Vec3(8, 0, 0), 1.5, new Lambertian(
    new PlanetTexture(new Vec3(0.2, 0.6, 0.15), new Vec3(0.1, 0.2, 0.7), new Vec3(0.95, 0.95, 0.95), 4)
  )));
  // Mars-like (red, rocky)
  world.add(new Sphere(new Vec3(-6, 1, 5), 0.8, new Lambertian(
    new NoiseTexture(new Vec3(0.8, 0.3, 0.1), 8)
  )));
  // Gas giant with stripes
  world.add(new Sphere(new Vec3(4, -2, -10), 2.5, new Lambertian(
    new StripeTexture([
      new Vec3(0.8, 0.6, 0.3), new Vec3(0.9, 0.7, 0.4),
      new Vec3(0.7, 0.5, 0.2), new Vec3(0.85, 0.65, 0.35),
      new Vec3(0.6, 0.4, 0.2)
    ], 6)
  )));
  // Moon (small, gray)
  world.add(new Sphere(new Vec3(10, 0.8, 0.5), 0.3, new Lambertian(new Vec3(0.7, 0.7, 0.7))));
  // Ice planet
  world.add(new Sphere(new Vec3(-10, -1, -6), 1.2, new Lambertian(
    new MarbleTexture(new Vec3(0.7, 0.8, 0.95), 3)
  )));
  // Metallic asteroid
  world.add(new Sphere(new Vec3(3, 3, 4), 0.4, new Metal(new Vec3(0.6, 0.6, 0.6), 0.3)));
  world.add(new Sphere(new Vec3(-4, -3, 3), 0.3, new Metal(new Vec3(0.5, 0.5, 0.5), 0.5)));
  return world;
}

function createShowcase() {
  const world = new HittableList();

  // Ground: checker
  world.add(new Sphere(new Vec3(0, -1000, 0), 1000, new Lambertian(new CheckerTexture(new Vec3(0.2, 0.3, 0.1), new Vec3(0.9, 0.9, 0.9)))));

  // Random small spheres (fewer than random scene for clarity)
  for (let a = -6; a < 6; a++) {
    for (let b = -6; b < 6; b++) {
      const r = Math.random();
      const center = new Vec3(a + 0.8 * Math.random(), 0.2, b + 0.8 * Math.random());
      if (center.sub(new Vec3(0, 0.2, 0)).length() > 2) {
        if (r < 0.6) world.add(new Sphere(center, 0.2, new Lambertian(Vec3.random().mul(Vec3.random()))));
        else if (r < 0.8) world.add(new Sphere(center, 0.2, new Metal(Vec3.random(0.5, 1), Math.random() * 0.3)));
        else if (r < 0.95) world.add(new Sphere(center, 0.2, new Dielectric(1.5)));
        else world.add(new Sphere(center, 0.2, new DiffuseLight(Vec3.random().mul(3))));
      }
    }
  }

  // Center: large glass sphere with fog inside
  const glassBoundary = new Sphere(new Vec3(0, 1, 0), 1.0, new Dielectric(1.5));
  world.add(glassBoundary);
  world.add(new ConstantMedium(new Sphere(new Vec3(0, 1, 0), 0.9, new Dielectric(1.5)), 0.2, new Vec3(0.2, 0.4, 0.9)));

  // Left: marble sphere
  world.add(new Sphere(new Vec3(-3, 1, 0), 1.0, new Lambertian(new MarbleTexture(new Vec3(0.9, 0.85, 0.8), 5))));

  // Right: perfect mirror
  world.add(new Sphere(new Vec3(3, 1, 0), 1.0, new Metal(new Vec3(0.95, 0.95, 0.95), 0.0)));

  // Behind: planet texture
  world.add(new Sphere(new Vec3(0, 1, -4), 1.0, new Lambertian(
    new PlanetTexture(new Vec3(0.2, 0.6, 0.15), new Vec3(0.1, 0.2, 0.7), new Vec3(0.95, 0.95, 0.95), 4)
  )));

  // Rotated metallic box
  world.add(new Translate(new RotateY(new Box(new Vec3(0,0,0), new Vec3(1,2,1), new Metal(new Vec3(0.8, 0.6, 0.2), 0.1)), 30), new Vec3(-5, 0, 2)));

  // Noise sphere
  world.add(new Sphere(new Vec3(5, 0.5, 3), 0.5, new Lambertian(new NoiseTexture(new Vec3(0.7, 0.3, 0.8), 8))));

  // Overhead area light
  world.add(new XZRect(-8, 8, -8, 8, 10, new DiffuseLight(new Vec3(1, 1, 1))));

  return world;
}

function createMotionBlur() {
  const world = new HittableList();
  world.add(new Sphere(new Vec3(0, -1000, 0), 1000, new Lambertian(new CheckerTexture(new Vec3(0.2, 0.3, 0.1), new Vec3(0.9, 0.9, 0.9)))));

  // Bouncing spheres with motion blur
  for (let a = -5; a < 5; a++) {
    for (let b = -5; b < 5; b++) {
      const r = Math.random();
      const center = new Vec3(a + 0.9 * Math.random(), 0.2, b + 0.9 * Math.random());
      if (center.sub(new Vec3(0, 0.2, 0)).length() > 1.5) {
        if (r < 0.5) {
          const albedo = Vec3.random().mul(Vec3.random());
          const bounce = new Vec3(0, Math.random() * 0.5, 0);
          world.add(new MovingSphere(center, center.add(bounce), 0, 1, 0.2, new Lambertian(albedo)));
        } else if (r < 0.75) {
          world.add(new Sphere(center, 0.2, new Metal(Vec3.random(0.5, 1), Math.random() * 0.3)));
        } else {
          world.add(new Sphere(center, 0.2, new Dielectric(1.5)));
        }
      }
    }
  }

  // Big spheres (stationary)
  world.add(new Sphere(new Vec3(0, 1, 0), 1.0, new Dielectric(1.5)));
  world.add(new Sphere(new Vec3(-2, 1, 0), 1.0, new Lambertian(new Vec3(0.4, 0.2, 0.1))));
  world.add(new Sphere(new Vec3(2, 1, 0), 1.0, new Metal(new Vec3(0.7, 0.6, 0.5), 0.0)));

  return world;
}

function createFinalScene() {
  const world = new HittableList();

  // Ground: boxes forming a surface
  const ground = new Lambertian(new Vec3(0.48, 0.83, 0.53));
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      const w = 100;
      const x0 = -1000 + i * w;
      const z0 = -1000 + j * w;
      const y0 = 0;
      const y1 = 1 + Math.random() * 100;
      world.add(new Box(new Vec3(x0, y0, z0), new Vec3(x0 + w, y1, z0 + w), ground));
    }
  }

  // Area light
  world.add(new XZRect(123, 423, 147, 412, 554, new DiffuseLight(new Vec3(7, 7, 7))));

  // Moving sphere (motion blur)
  const c1 = new Vec3(400, 400, 200);
  const c2 = c1.add(new Vec3(30, 0, 0));
  world.add(new MovingSphere(c1, c2, 0, 1, 50, new Lambertian(new Vec3(0.7, 0.3, 0.1))));

  // Glass sphere
  world.add(new Sphere(new Vec3(260, 150, 45), 50, new Dielectric(1.5)));
  // Metal sphere
  world.add(new Sphere(new Vec3(0, 150, 145), 50, new Metal(new Vec3(0.8, 0.8, 0.9), 1.0)));

  // Glass sphere with fog inside (subsurface scattering)
  const boundary1 = new Sphere(new Vec3(360, 150, 145), 70, new Dielectric(1.5));
  world.add(boundary1);
  world.add(new ConstantMedium(new Sphere(new Vec3(360, 150, 145), 70, new Dielectric(1.5)), 0.2, new Vec3(0.2, 0.4, 0.9)));

  // Global fog
  world.add(new ConstantMedium(new Sphere(new Vec3(0, 0, 0), 5000, new Dielectric(1.5)), 0.0001, new Vec3(1, 1, 1)));

  // Marble sphere
  world.add(new Sphere(new Vec3(220, 280, 300), 80, new Lambertian(new MarbleTexture(new Vec3(0.9, 0.9, 0.9), 0.1))));

  // Cluster of small spheres (noise textured)
  for (let i = 0; i < 50; i++) {
    const center = new Vec3(165 + Math.random() * 165, 270 + Math.random() * 165, 395 + Math.random() * 165);
    world.add(new Sphere(center, 10, new Lambertian(new Vec3(0.73, 0.73, 0.73))));
  }

  return world;
}

function createMuseum() {
  const world = new HittableList();

  // Floor: marble checker
  world.add(new Sphere(new Vec3(0, -1000, 0), 1000, new Lambertian(new CheckerTexture(new Vec3(0.1, 0.1, 0.1), new Vec3(0.95, 0.9, 0.85), 8))));

  // Ceiling light
  world.add(new XZRect(-4, 4, -8, 4, 6, new DiffuseLight(new Vec3(4, 3.8, 3.5))));

  // Pedestal 1: marble sphere on cylinder base
  world.add(new Cylinder(new Vec3(-3, 0, -1), 0.6, 0, 1.5, new Lambertian(new Vec3(0.9, 0.9, 0.88))));
  world.add(new Disk(new Vec3(-3, 1.5, -1), new Vec3(0, 1, 0), 0.6, new Lambertian(new Vec3(0.9, 0.9, 0.88))));
  world.add(new Sphere(new Vec3(-3, 2.2, -1), 0.5, new Lambertian(new MarbleTexture(new Vec3(0.95, 0.9, 0.85), 5))));

  // Pedestal 2: colored glass sphere
  world.add(new Cylinder(new Vec3(0, 0, -1), 0.6, 0, 1.0, new Lambertian(new Vec3(0.85, 0.85, 0.82))));
  world.add(new Disk(new Vec3(0, 1.0, -1), new Vec3(0, 1, 0), 0.6, new Lambertian(new Vec3(0.85, 0.85, 0.82))));
  world.add(new Sphere(new Vec3(0, 1.7, -1), 0.5, new ColoredGlass(1.5, new Vec3(0.2, 0.8, 0.2), 2.0)));

  // Pedestal 3: perfect mirror sphere
  world.add(new Cylinder(new Vec3(3, 0, -1), 0.6, 0, 1.8, new Lambertian(new Vec3(0.88, 0.88, 0.85))));
  world.add(new Disk(new Vec3(3, 1.8, -1), new Vec3(0, 1, 0), 0.6, new Lambertian(new Vec3(0.88, 0.88, 0.85))));
  world.add(new Sphere(new Vec3(3, 2.5, -1), 0.5, new Metal(new Vec3(0.97, 0.97, 0.97), 0.0)));

  // Red glass sphere (ruby)
  world.add(new Sphere(new Vec3(1.5, 0.5, 1), 0.5, new ColoredGlass(1.77, new Vec3(0.9, 0.1, 0.1), 3.0)));

  // Blue glass sphere (sapphire)
  world.add(new Sphere(new Vec3(-1.5, 0.5, 1), 0.5, new ColoredGlass(1.77, new Vec3(0.1, 0.1, 0.9), 3.0)));

  // Back wall with noise texture
  world.add(new Sphere(new Vec3(0, 0, -(1005)), 1000, new Lambertian(new NoiseTexture(new Vec3(0.9, 0.85, 0.8), 2))));

  return world;
}

// ===== Expose to global =====
if (typeof self !== 'undefined') {
  self.RayTracer = {
    Vec3, Ray, HitRecord, HittableList, AABB, BVHNode, Sphere, XZRect, XYRect, YZRect, Box, Translate, RotateY, Disk, Cylinder, ColoredGlass,
    SolidColor, CheckerTexture, NoiseTexture, MarbleTexture,
    Isotropic, ConstantMedium,
    Lambertian, Metal, Dielectric, DiffuseLight, Camera,
    createRandomScene, createSimpleScene, createCornellBox,
    createGlassStudy, createMetalShowcase, createLitRoom, createTexturedWorld, createSmokyCornell, createSolarSystem, createShowcase, createMotionBlur, createFinalScene, createMuseum, MovingSphere
  };
}
