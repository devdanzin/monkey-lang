// sampling.js — Importance sampling utilities for path tracing
//
// Cosine-weighted hemisphere sampling: p(ω) = cos(θ)/π
// Reduces variance for diffuse surfaces compared to uniform sampling.

import { Vec3 } from './vec3.js';

/**
 * Generate a cosine-weighted random direction on the hemisphere around normal.
 * Uses Malley's method: sample uniformly on unit disk, then project to hemisphere.
 * Distribution: p(ω) = cos(θ)/π
 */
export function cosineWeightedHemisphere(normal) {
  // Build orthonormal basis from normal
  const [tangent, bitangent] = buildONB(normal);
  
  // Random point on unit disk (Malley's method)
  const r1 = Math.random();
  const r2 = Math.random();
  const phi = 2 * Math.PI * r1;
  const sqrtR2 = Math.sqrt(r2);
  
  // Convert to hemisphere coordinates
  const x = Math.cos(phi) * sqrtR2;
  const y = Math.sin(phi) * sqrtR2;
  const z = Math.sqrt(1 - r2);
  
  // Transform to world space
  return tangent.mul(x).add(bitangent.mul(y)).add(normal.mul(z));
}

/**
 * PDF value for cosine-weighted hemisphere sampling
 */
export function cosineWeightedPDF(normal, direction) {
  const cosTheta = normal.dot(direction.unit());
  if (cosTheta <= 0) return 0;
  return cosTheta / Math.PI;
}

/**
 * Uniform hemisphere sampling: p(ω) = 1/(2π)
 */
export function uniformHemisphere(normal) {
  const [tangent, bitangent] = buildONB(normal);
  
  const r1 = Math.random();
  const r2 = Math.random();
  const phi = 2 * Math.PI * r1;
  const cosTheta = r2;
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  
  const x = Math.cos(phi) * sinTheta;
  const y = Math.sin(phi) * sinTheta;
  const z = cosTheta;
  
  return tangent.mul(x).add(bitangent.mul(y)).add(normal.mul(z));
}

/**
 * PDF for uniform hemisphere: 1/(2π)
 */
export function uniformHemispherePDF() {
  return 1.0 / (2 * Math.PI);
}

/**
 * Build orthonormal basis from a single vector (the normal).
 * Returns [tangent, bitangent] perpendicular to normal.
 */
export function buildONB(n) {
  const normalized = n.unit();
  // Choose a vector not parallel to n
  const helper = Math.abs(normalized.x) > 0.9 
    ? new Vec3(0, 1, 0) 
    : new Vec3(1, 0, 0);
  const tangent = normalized.cross(helper).unit();
  const bitangent = normalized.cross(tangent);
  return [tangent, bitangent];
}

/**
 * Power heuristic for multiple importance sampling (MIS)
 * Veach & Guibas, 1995
 */
export function powerHeuristic(nf, fPdf, ng, gPdf) {
  const f = nf * fPdf;
  const g = ng * gPdf;
  return (f * f) / (f * f + g * g);
}
