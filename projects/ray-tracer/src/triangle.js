// triangle.js — Triangle primitive using Möller–Trumbore intersection

import { Vec3 } from './vec3.js';
import { HitRecord } from './hittable.js';
import { AABB } from './aabb.js';
import { computeTBN, applyNormalMap, interpolateNormal, interpolateUV } from './normal-map.js';

export class Triangle {
  /**
   * @param {Vec3} v0, v1, v2 - Vertices
   * @param {Object} material - Material
   * @param {Object} [opts] - Optional: normals, uvs, normalMap
   * @param {Vec3[]} [opts.normals] - Per-vertex normals [n0, n1, n2] for smooth shading
   * @param {number[][]} [opts.uvs] - Per-vertex UVs [[u0,v0], [u1,v1], [u2,v2]]
   * @param {Object} [opts.normalMap] - Normal map texture (must have .value(u, v) → Vec3)
   */
  constructor(v0, v1, v2, material, opts = {}) {
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.material = material;

    // Precompute edge vectors and face normal
    this.edge1 = v1.sub(v0);
    this.edge2 = v2.sub(v0);
    this.faceNormal = this.edge1.cross(this.edge2).unit();

    // Optional smooth shading normals
    this.normals = opts.normals || null; // [n0, n1, n2]

    // Optional UV coordinates
    this.uvs = opts.uvs || null; // [[u0,v0], [u1,v1], [u2,v2]]

    // Optional normal map texture
    this.normalMap = opts.normalMap || null;
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
    rec.u = u;
    rec.v = v;
    rec.material = this.material;

    // Determine shading normal
    let shadingNormal = this.faceNormal;

    // Smooth shading: interpolate per-vertex normals
    if (this.normals) {
      shadingNormal = interpolateNormal(
        this.normals[0], this.normals[1], this.normals[2], u, v
      );
    }

    // Normal mapping: perturb shading normal with normal map texture
    if (this.normalMap && this.uvs) {
      const texUV = interpolateUV(this.uvs[0], this.uvs[1], this.uvs[2], u, v);
      const tbn = computeTBN(
        this.v0, this.v1, this.v2,
        this.uvs[0], this.uvs[1], this.uvs[2],
        shadingNormal
      );
      const normalSample = this.normalMap.value(texUV[0], texUV[1]);
      shadingNormal = applyNormalMap(normalSample, tbn);
    }

    rec.setFaceNormal(ray, shadingNormal);

    // Override UV with texture UV if available
    if (this.uvs) {
      const texUV = interpolateUV(this.uvs[0], this.uvs[1], this.uvs[2], u, v);
      rec.u = texUV[0];
      rec.v = texUV[1];
    }

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

  // Parse OBJ format with normals and UVs
  static fromOBJ(objText, material) {
    const vertices = [];
    const normals = [];
    const texCoords = [];
    const triangles = [];

    for (const line of objText.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'v') {
        vertices.push(new Vec3(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])));
      } else if (parts[0] === 'vn') {
        normals.push(new Vec3(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])));
      } else if (parts[0] === 'vt') {
        texCoords.push([parseFloat(parts[1]), parseFloat(parts[2]) || 0]);
      } else if (parts[0] === 'f') {
        // Face — indices are 1-based, format: v/vt/vn or v//vn or v/vt or v
        const faceVerts = parts.slice(1).map(p => {
          const indices = p.split('/');
          return {
            vi: parseInt(indices[0]) - 1,
            ti: indices[1] ? parseInt(indices[1]) - 1 : -1,
            ni: indices[2] ? parseInt(indices[2]) - 1 : (indices.length === 2 ? -1 : -1),
          };
        });

        // Triangulate fan-style for polygons with more than 3 vertices
        for (let i = 1; i < faceVerts.length - 1; i++) {
          const f0 = faceVerts[0], f1 = faceVerts[i], f2 = faceVerts[i + 1];
          const opts = {};

          // Per-vertex normals
          if (f0.ni >= 0 && f1.ni >= 0 && f2.ni >= 0 &&
              normals[f0.ni] && normals[f1.ni] && normals[f2.ni]) {
            opts.normals = [normals[f0.ni], normals[f1.ni], normals[f2.ni]];
          }

          // Per-vertex UVs
          if (f0.ti >= 0 && f1.ti >= 0 && f2.ti >= 0 &&
              texCoords[f0.ti] && texCoords[f1.ti] && texCoords[f2.ti]) {
            opts.uvs = [texCoords[f0.ti], texCoords[f1.ti], texCoords[f2.ti]];
          }

          triangles.push(new Triangle(
            vertices[f0.vi], vertices[f1.vi], vertices[f2.vi],
            material, opts
          ));
        }
      }
    }

    return new Mesh(triangles);
  }
}
