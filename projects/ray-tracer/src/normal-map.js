// normal-map.js — Normal mapping for triangles with tangent space computation

import { Vec3 } from './vec3.js';

/**
 * Compute tangent space basis (TBN matrix) for a triangle with UV coordinates.
 * Used to transform normal map samples from tangent space to world space.
 *
 * @param {Vec3} v0, v1, v2 - Triangle vertices
 * @param {number[]} uv0, uv1, uv2 - UV coordinates [u, v] for each vertex
 * @param {Vec3} normal - Face normal (or interpolated smooth normal)
 * @returns {{ tangent: Vec3, bitangent: Vec3, normal: Vec3 }}
 */
export function computeTBN(v0, v1, v2, uv0, uv1, uv2, normal) {
  const edge1 = v1.sub(v0);
  const edge2 = v2.sub(v0);

  const deltaUV1 = [uv1[0] - uv0[0], uv1[1] - uv0[1]];
  const deltaUV2 = [uv2[0] - uv0[0], uv2[1] - uv0[1]];

  let det = deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1];
  if (Math.abs(det) < 1e-10) {
    // Degenerate UV — use default tangent frame
    return defaultTBN(normal);
  }

  const f = 1.0 / det;

  let tangent = new Vec3(
    f * (deltaUV2[1] * edge1.x - deltaUV1[1] * edge2.x),
    f * (deltaUV2[1] * edge1.y - deltaUV1[1] * edge2.y),
    f * (deltaUV2[1] * edge1.z - deltaUV1[1] * edge2.z)
  );

  // Gram-Schmidt orthogonalize: T' = normalize(T - (T·N)*N)
  tangent = tangent.sub(normal.mul(tangent.dot(normal)));
  const tLen = tangent.length();
  if (tLen < 1e-10) return defaultTBN(normal);
  tangent = tangent.mul(1.0 / tLen);

  // Bitangent = N × T (right-handed)
  let bitangent = normal.cross(tangent);

  // Check handedness
  const expectedSign = deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1];
  if (expectedSign < 0) {
    bitangent = bitangent.mul(-1);
  }

  return { tangent, bitangent, normal };
}

/**
 * Default tangent frame when UVs are degenerate
 */
function defaultTBN(normal) {
  const n = normal.unit();
  // Pick a non-parallel vector to construct tangent
  const up = Math.abs(n.y) < 0.999 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
  const tangent = up.cross(n).unit();
  const bitangent = n.cross(tangent);
  return { tangent, bitangent, normal: n };
}

/**
 * Transform a normal map sample from tangent space to world space.
 *
 * @param {Vec3} normalMapValue - Normal from texture, usually in [0,1] range (needs remapping to [-1,1])
 * @param {{ tangent: Vec3, bitangent: Vec3, normal: Vec3 }} tbn - Tangent space basis
 * @returns {Vec3} World-space normal (unit vector)
 */
export function applyNormalMap(normalMapValue, tbn) {
  // Remap from [0,1] to [-1,1] if needed
  let nx = normalMapValue.x;
  let ny = normalMapValue.y;
  let nz = normalMapValue.z;

  // Normal maps are typically stored as [0,1] — check and remap
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 && nz >= 0 && nz <= 1) {
    nx = nx * 2 - 1;
    ny = ny * 2 - 1;
    nz = nz * 2 - 1;
  }

  // Transform from tangent space to world space: worldN = T*nx + B*ny + N*nz
  const worldNormal = tbn.tangent.mul(nx)
    .add(tbn.bitangent.mul(ny))
    .add(tbn.normal.mul(nz));

  const len = worldNormal.length();
  return len > 1e-10 ? worldNormal.mul(1.0 / len) : tbn.normal;
}

/**
 * Interpolate per-vertex normals using barycentric coordinates
 *
 * @param {Vec3} n0, n1, n2 - Vertex normals
 * @param {number} u, v - Barycentric coordinates (w = 1 - u - v)
 * @returns {Vec3} Interpolated normal (unit vector)
 */
export function interpolateNormal(n0, n1, n2, u, v) {
  const w = 1 - u - v;
  const normal = n0.mul(w).add(n1.mul(u)).add(n2.mul(v));
  const len = normal.length();
  return len > 1e-10 ? normal.mul(1.0 / len) : n0;
}

/**
 * Interpolate UV coordinates using barycentric coordinates
 */
export function interpolateUV(uv0, uv1, uv2, u, v) {
  const w = 1 - u - v;
  return [
    uv0[0] * w + uv1[0] * u + uv2[0] * v,
    uv0[1] * w + uv1[1] * u + uv2[1] * v,
  ];
}
