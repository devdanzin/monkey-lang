// bokeh.js — Aperture shape sampling for depth-of-field bokeh
// Different aperture shapes produce different out-of-focus blur patterns

import { Vec3 } from './vec3.js';

/**
 * Sample a point on a unit disk (circular aperture — default)
 * Produces smooth, round bokeh
 */
export function sampleCircle() {
  while (true) {
    const x = -1 + 2 * Math.random();
    const y = -1 + 2 * Math.random();
    if (x * x + y * y < 1) return new Vec3(x, y, 0);
  }
}

/**
 * Sample a point inside a regular polygon (n-bladed aperture)
 * Creates polygonal bokeh like real camera lenses
 * @param {number} blades - Number of aperture blades (5-9 typical)
 * @param {number} rotation - Rotation angle in radians
 */
export function samplePolygon(blades = 6, rotation = 0) {
  // Pick a random triangle of the polygon
  const triangleIdx = Math.floor(Math.random() * blades);
  const angle0 = rotation + (2 * Math.PI * triangleIdx) / blades;
  const angle1 = rotation + (2 * Math.PI * (triangleIdx + 1)) / blades;

  // Random point in triangle (center, vertex0, vertex1)
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) { u = 1 - u; v = 1 - v; }

  // Vertices: center (0,0) and two polygon vertices
  const x = v * Math.cos(angle0) + (1 - u - v) * 0 + u * Math.cos(angle1);
  const y = v * Math.sin(angle0) + (1 - u - v) * 0 + u * Math.sin(angle1);

  // Wait — barycentric: P = (1-u-v)*A + u*B + v*C
  // A = center(0,0), B = vertex0, C = vertex1
  // So P = u * vertex0 + v * vertex1 (since A=0)
  // But we already have the right formula with the swap above
  return new Vec3(x, y, 0);
}

/**
 * Create a hexagonal aperture sampler (6 blades)
 * Most common in photography
 */
export function sampleHexagon(rotation = 0) {
  return samplePolygon(6, rotation);
}

/**
 * Create a pentagonal aperture sampler (5 blades)
 */
export function samplePentagon(rotation = 0) {
  return samplePolygon(5, rotation);
}

/**
 * Sample a point inside a star shape
 * Creates star-shaped bokeh (like starburst filters)
 * @param {number} points - Number of star points
 * @param {number} innerRadius - Inner radius as fraction of outer (0-1)
 */
export function sampleStar(points = 6, innerRadius = 0.4) {
  // Use rejection sampling on star polygon
  while (true) {
    const x = -1 + 2 * Math.random();
    const y = -1 + 2 * Math.random();
    if (x * x + y * y >= 1) continue;

    // Check if point is inside star shape
    const angle = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);

    // Distance to star edge at this angle
    const n = points;
    const sectorAngle = (2 * Math.PI) / n;
    const halfSector = sectorAngle / 2;

    // Angle within current sector
    let a = ((angle % sectorAngle) + sectorAngle) % sectorAngle;
    if (a > halfSector) a = sectorAngle - a;

    // Interpolate between inner and outer radius
    const t = a / halfSector; // 0 at tip, 1 at valley
    const edgeR = 1 * (1 - t) + innerRadius * t;

    if (r <= edgeR) return new Vec3(x, y, 0);
  }
}

/**
 * Sample a point inside a heart shape
 * Novelty bokeh effect
 */
export function sampleHeart() {
  while (true) {
    const x = -1 + 2 * Math.random();
    const y = -1 + 2 * Math.random();

    // Heart curve: (x² + y² - 1)³ - x²y³ <= 0
    const x2 = x * x;
    const y2 = (y - 0.2) * (y - 0.2); // shift up slightly
    const yy = y - 0.2;
    const t = x2 + y2 - 1;
    if (t * t * t - x2 * yy * yy * yy <= 0) {
      return new Vec3(x * 0.7, (y - 0.1) * 0.7, 0); // scale to fit
    }
  }
}

/**
 * Sample a point in an annular (ring/donut) shape
 * Creates ring bokeh like catadioptric (mirror) lenses
 * @param {number} innerRadius - Inner radius (0-1)
 */
export function sampleRing(innerRadius = 0.5) {
  while (true) {
    const x = -1 + 2 * Math.random();
    const y = -1 + 2 * Math.random();
    const r2 = x * x + y * y;
    if (r2 < 1 && r2 >= innerRadius * innerRadius) {
      return new Vec3(x, y, 0);
    }
  }
}

/**
 * Create a bokeh sampler function from a shape name
 * @param {string} shape - Shape name
 * @param {object} opts - Shape-specific options
 * @returns {Function} Sampler function returning Vec3
 */
export function createBokehSampler(shape = 'circle', opts = {}) {
  switch (shape) {
    case 'circle': return sampleCircle;
    case 'hexagon': return () => sampleHexagon(opts.rotation || 0);
    case 'pentagon': return () => samplePentagon(opts.rotation || 0);
    case 'polygon': return () => samplePolygon(opts.blades || 6, opts.rotation || 0);
    case 'star': return () => sampleStar(opts.points || 6, opts.innerRadius || 0.4);
    case 'heart': return sampleHeart;
    case 'ring': return () => sampleRing(opts.innerRadius || 0.5);
    default: return sampleCircle;
  }
}

/**
 * Available bokeh shapes
 */
export const BOKEH_SHAPES = ['circle', 'hexagon', 'pentagon', 'polygon', 'star', 'heart', 'ring'];
