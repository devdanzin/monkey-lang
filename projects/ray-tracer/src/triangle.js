// triangle.js — Triangle primitive using Möller–Trumbore intersection

import { Vec3 } from './vec3.js';
import { HitRecord } from './hittable.js';
import { AABB } from './aabb.js';

export class Triangle {
  constructor(v0, v1, v2, material) {
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.material = material;

    // Precompute edge vectors and face normal
    this.edge1 = v1.sub(v0);
    this.edge2 = v2.sub(v0);
    this.faceNormal = this.edge1.cross(this.edge2).unit();
  }

  hit(ray, tMin, tMax) {
    // Möller–Trumbore algorithm
    const h = ray.direction.cross(this.edge2);
    const a = this.edge1.dot(h);

    if (Math.abs(a) < 1e-8) return null; // Parallel

    const f = 1.0 / a;
    const s = ray.origin.sub(this.v0);
    const u = f * s.dot(h);
    if (u < 0.0 || u > 1.0) return null;

    const q = s.cross(this.edge1);
    const v = f * ray.direction.dot(q);
    if (v < 0.0 || u + v > 1.0) return null;

    const t = f * this.edge2.dot(q);
    if (t <= tMin || t >= tMax) return null;

    const rec = new HitRecord();
    rec.t = t;
    rec.p = ray.at(t);
    rec.setFaceNormal(ray, this.faceNormal);
    rec.material = this.material;
    rec.u = u;
    rec.v = v;

    return rec;
  }

  boundingBox() {
    const eps = 0.0001;
    const min = new Vec3(
      Math.min(this.v0.x, this.v1.x, this.v2.x) - eps,
      Math.min(this.v0.y, this.v1.y, this.v2.y) - eps,
      Math.min(this.v0.z, this.v1.z, this.v2.z) - eps
    );
    const max = new Vec3(
      Math.max(this.v0.x, this.v1.x, this.v2.x) + eps,
      Math.max(this.v0.y, this.v1.y, this.v2.y) + eps,
      Math.max(this.v0.z, this.v1.z, this.v2.z) + eps
    );
    return new AABB(min, max);
  }
}

// Mesh — collection of triangles with BVH
import { BVHNode } from './bvh.js';

export class Mesh {
  constructor(triangles) {
    this.triangles = triangles;
    if (triangles.length > 4) {
      this.bvh = new BVHNode([...triangles]);
    } else {
      this.bvh = null;
    }
  }

  hit(ray, tMin, tMax) {
    if (this.bvh) return this.bvh.hit(ray, tMin, tMax);

    let closest = tMax;
    let result = null;
    for (const tri of this.triangles) {
      const rec = tri.hit(ray, tMin, closest);
      if (rec) { closest = rec.t; result = rec; }
    }
    return result;
  }

  boundingBox() {
    if (this.bvh) return this.bvh.boundingBox();
    if (this.triangles.length === 0) return null;
    let box = this.triangles[0].boundingBox();
    for (let i = 1; i < this.triangles.length; i++) {
      box = AABB.surrounding(box, this.triangles[i].boundingBox());
    }
    return box;
  }

  // Parse basic OBJ format
  static fromOBJ(objText, material) {
    const vertices = [];
    const triangles = [];

    for (const line of objText.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'v') {
        vertices.push(new Vec3(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])));
      } else if (parts[0] === 'f') {
        // Face — indices are 1-based, may include vertex/texture/normal refs
        const indices = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
        // Triangulate fan-style for polygons with more than 3 vertices
        for (let i = 1; i < indices.length - 1; i++) {
          triangles.push(new Triangle(vertices[indices[0]], vertices[indices[i]], vertices[indices[i + 1]], material));
        }
      }
    }

    return new Mesh(triangles);
  }
}
