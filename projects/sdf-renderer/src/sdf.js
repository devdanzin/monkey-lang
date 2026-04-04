// sdf.js — Signed Distance Functions library
// Each function returns the minimum distance from a point to a surface.
// Negative = inside, positive = outside, zero = on surface.

import { Vec3, vec3, clamp } from './vec3.js';

// ===== Primitives =====

// Sphere centered at origin with radius r
export function sdSphere(p, r) {
  return p.length() - r;
}

// Box centered at origin with half-extents b
export function sdBox(p, b) {
  const q = p.abs().sub(b);
  return q.max(0).length() + Math.min(q.maxComponent(), 0);
}

// Infinite plane at y=0 (normal pointing up)
export function sdPlane(p, n = vec3(0, 1, 0), h = 0) {
  return p.dot(n) + h;
}

// Torus centered at origin, lying in XZ plane
// t.x = major radius, t.y = minor radius
export function sdTorus(p, major, minor) {
  const q = vec3(Math.sqrt(p.x * p.x + p.z * p.z) - major, p.y);
  return Math.sqrt(q.x * q.x + q.y * q.y) - minor;
}

// Cylinder along Y axis
export function sdCylinder(p, r, h) {
  const d = vec3(Math.sqrt(p.x * p.x + p.z * p.z) - r, Math.abs(p.y) - h);
  return Math.min(Math.max(d.x, d.y), 0) + vec3(Math.max(d.x, 0), Math.max(d.y, 0)).length();
}

// Cone along Y axis (angle in radians, height h)
export function sdCone(p, angle, h) {
  const q = vec3(Math.sqrt(p.x * p.x + p.z * p.z), p.y);
  const tip = vec3(0, h);
  const c = vec3(Math.sin(angle), Math.cos(angle));
  const a = q.sub(tip);
  const w = vec3(a.dot(vec3(c.y, -c.x)), a.dot(c));
  return Math.max(
    Math.sqrt(Math.max(w.x, 0) ** 2 + Math.max(w.y, 0) ** 2) + Math.min(Math.max(w.x, w.y), 0),
    -q.y
  );
}

// Capsule from point a to point b with radius r
export function sdCapsule(p, a, b, r) {
  const pa = p.sub(a);
  const ba = b.sub(a);
  const h = clamp(pa.dot(ba) / ba.dot(ba), 0, 1);
  return pa.sub(ba.mul(h)).length() - r;
}

// Rounded box
export function sdRoundBox(p, b, r) {
  const q = p.abs().sub(b);
  return q.max(0).length() + Math.min(q.maxComponent(), 0) - r;
}

// ===== CSG Operations =====

// Union (min)
export function opUnion(d1, d2) {
  return Math.min(d1, d2);
}

// Intersection (max)
export function opIntersection(d1, d2) {
  return Math.max(d1, d2);
}

// Subtraction (d1 minus d2)
export function opSubtraction(d1, d2) {
  return Math.max(d1, -d2);
}

// Smooth union — blends surfaces smoothly
export function opSmoothUnion(d1, d2, k) {
  const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0, 1);
  return d2 * (1 - h) + d1 * h - k * h * (1 - h);
}

// Smooth subtraction
export function opSmoothSubtraction(d1, d2, k) {
  const h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0, 1);
  return -d2 * (1 - h) + d1 * h + k * h * (1 - h);
}

// Smooth intersection
export function opSmoothIntersection(d1, d2, k) {
  const h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0, 1);
  return d2 * (1 - h) + d1 * h + k * h * (1 - h);
}

// ===== Transforms =====

// Translate: evaluate SDF at translated point
export function opTranslate(p, offset) {
  return p.sub(offset);
}

// Rotate around Y axis
export function opRotateY(p, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// Rotate around X axis
export function opRotateX(p, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

// Rotate around Z axis
export function opRotateZ(p, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

// Scale (divide distance by scale factor)
export function opScale(p, s) {
  return p.div(s);
}

// Domain repetition (infinite copies)
export function opRepeat(p, spacing) {
  return vec3(
    ((p.x % spacing.x) + spacing.x) % spacing.x - spacing.x * 0.5,
    ((p.y % spacing.y) + spacing.y) % spacing.y - spacing.y * 0.5,
    ((p.z % spacing.z) + spacing.z) % spacing.z - spacing.z * 0.5
  );
}

// Limited domain repetition
export function opRepeatLimited(p, spacing, limit) {
  return p.sub(spacing.mul(clamp(Math.round(p.x / spacing.x), -limit.x, limit.x)).add(
    vec3(0, clamp(Math.round(p.y / spacing.y), -limit.y, limit.y) * spacing.y, 0)).add(
    vec3(0, 0, clamp(Math.round(p.z / spacing.z), -limit.z, limit.z) * spacing.z)));
}

// ===== Normal Estimation =====
// Compute surface normal via numerical gradient of the SDF
export function estimateNormal(sdfFunc, p, eps = 0.001) {
  const ex = vec3(eps, 0, 0);
  const ey = vec3(0, eps, 0);
  const ez = vec3(0, 0, eps);
  return vec3(
    sdfFunc(p.add(ex)) - sdfFunc(p.sub(ex)),
    sdfFunc(p.add(ey)) - sdfFunc(p.sub(ey)),
    sdfFunc(p.add(ez)) - sdfFunc(p.sub(ez))
  ).normalize();
}
