// debug.js — Debug rendering modes (BVH visualization, normals, UV)

import { Color, Vec3 } from './vec3.js';

// Render modes for debugging
export const DebugMode = {
  NORMAL: 'normal',       // Normal map (RGB = XYZ of surface normal)
  DEPTH: 'depth',         // Depth map (white = near, black = far)
  UV: 'uv',              // UV coordinate visualization
  BVH_DEPTH: 'bvh_depth', // BVH traversal depth (hotter = more nodes tested)
  FLAT: 'flat',           // Flat shading (no bouncing, just material color)
};

// Normal map: maps normal vector components [-1,1] to color [0,1]
export function debugNormal(rec) {
  if (!rec) return new Color(0, 0, 0);
  const n = rec.normal;
  return new Color(
    (n.x + 1) * 0.5,
    (n.y + 1) * 0.5,
    (n.z + 1) * 0.5
  );
}

// Depth map: closer = brighter
export function debugDepth(rec, maxDist = 20) {
  if (!rec) return new Color(0.5, 0.7, 1.0); // Sky
  const d = 1 - Math.min(rec.t / maxDist, 1);
  return new Color(d, d, d);
}

// UV visualization
export function debugUV(rec) {
  if (!rec) return new Color(0, 0, 0);
  const u = rec.u || 0;
  const v = rec.v || 0;
  return new Color(u, v, 0);
}

// Count BVH nodes traversed for a single ray
export function countBVHNodes(bvh, ray, tMin, tMax) {
  let count = 0;

  function traverse(node) {
    if (!node || !node.box) return;
    count++;
    if (!node.box.hit(ray, tMin, tMax)) return;

    if (node.left && node.left.box) {
      traverse(node.left);
    } else if (node.left && node.left.hit) {
      count++; // Leaf node test
    }

    if (node.right && node.right !== node.left && node.right.box) {
      traverse(node.right);
    } else if (node.right && node.right !== node.left && node.right.hit) {
      count++;
    }
  }

  traverse(bvh);
  return count;
}

// Heat map color for BVH depth
export function heatMapColor(value) {
  // 0 = blue, 0.5 = green, 1.0 = red
  const r = Math.max(0, Math.min(1, 2 * value - 0.5));
  const g = Math.max(0, 1 - Math.abs(2 * value - 1));
  const b = Math.max(0, Math.min(1, 1.5 - 2 * value));
  return new Color(r, g, b);
}
