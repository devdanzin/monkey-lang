import { Individual } from './individual.js';

/**
 * Polygon Art Evolver — evolve semi-transparent polygons to approximate a target image.
 * 
 * Genome encoding:
 * Each polygon has: [r, g, b, a, x1, y1, x2, y2, x3, y3, ...]
 * - RGBA: 4 values in [0, 1]
 * - Vertices: pairs of (x, y) in [0, 1] (normalized coordinates)
 * 
 * A full genome is an array of polygons, flattened:
 * [poly1_r, poly1_g, poly1_b, poly1_a, poly1_x1, poly1_y1, ..., poly2_r, ...]
 */

/**
 * Configuration for polygon art evolution.
 * @typedef {Object} PolygonConfig
 * @property {number} numPolygons — number of polygons per individual
 * @property {number} verticesPerPolygon — vertices per polygon (default 3 = triangles)
 * @property {number} width — image width
 * @property {number} height — image height
 */

const RGBA_GENES = 4; // r, g, b, a

/**
 * Get number of genes per polygon.
 */
export function genesPerPolygon(verticesPerPolygon = 3) {
  return RGBA_GENES + verticesPerPolygon * 2;
}

/**
 * Get total genome length.
 */
export function genomeLength(numPolygons, verticesPerPolygon = 3) {
  return numPolygons * genesPerPolygon(verticesPerPolygon);
}

/**
 * Decode a flat gene array into structured polygon data.
 * @param {number[]} genes — flat array of gene values in [0, 1]
 * @param {number} numPolygons
 * @param {number} [verticesPerPoly=3]
 * @returns {Array<{r, g, b, a, vertices: Array<[number, number]>}>}
 */
export function decodePolygons(genes, numPolygons, verticesPerPoly = 3) {
  const gpoly = genesPerPolygon(verticesPerPoly);
  const polygons = [];
  for (let i = 0; i < numPolygons; i++) {
    const offset = i * gpoly;
    const poly = {
      r: genes[offset],
      g: genes[offset + 1],
      b: genes[offset + 2],
      a: genes[offset + 3],
      vertices: []
    };
    for (let v = 0; v < verticesPerPoly; v++) {
      const vi = offset + RGBA_GENES + v * 2;
      poly.vertices.push([genes[vi], genes[vi + 1]]);
    }
    polygons.push(poly);
  }
  return polygons;
}

/**
 * Render polygons to a pixel buffer (software renderer, no Canvas required).
 * Uses scanline rasterization with alpha compositing.
 * 
 * @param {Array} polygons — decoded polygon array
 * @param {number} width
 * @param {number} height
 * @returns {Uint8ClampedArray} — RGBA pixel data (width * height * 4)
 */
export function renderPolygons(polygons, width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  // Start with white background
  pixels.fill(255);

  for (const poly of polygons) {
    const r = Math.round(poly.r * 255);
    const g = Math.round(poly.g * 255);
    const b = Math.round(poly.b * 255);
    const a = poly.a;

    // Convert normalized vertices to pixel coordinates
    const verts = poly.vertices.map(([x, y]) => [x * width, y * height]);

    // Get bounding box
    const minX = Math.max(0, Math.floor(Math.min(...verts.map(v => v[0]))));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...verts.map(v => v[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...verts.map(v => v[1]))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...verts.map(v => v[1]))));

    // For each pixel in bounding box, check if inside polygon
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolygon(x + 0.5, y + 0.5, verts)) {
          const idx = (y * width + x) * 4;
          // Alpha compositing (over operation)
          pixels[idx] = Math.round(r * a + pixels[idx] * (1 - a));
          pixels[idx + 1] = Math.round(g * a + pixels[idx + 1] * (1 - a));
          pixels[idx + 2] = Math.round(b * a + pixels[idx + 2] * (1 - a));
          // Keep alpha at 255 (fully opaque result)
        }
      }
    }
  }
  return pixels;
}

/**
 * Point-in-polygon test using ray casting.
 */
function pointInPolygon(px, py, vertices) {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = vertices[i];
    const [xj, yj] = vertices[j];
    if ((yi > py) !== (yj > py) &&
        px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Compute pixel-level fitness: negative mean squared error between two pixel buffers.
 * Higher = better (closer to target).
 * 
 * @param {Uint8ClampedArray} rendered — candidate image
 * @param {Uint8ClampedArray} target — target image
 * @returns {number} negative MSE (higher = better match)
 */
export function pixelFitness(rendered, target) {
  let sumSqError = 0;
  const n = rendered.length;
  for (let i = 0; i < n; i += 4) { // skip alpha channel
    const dr = rendered[i] - target[i];
    const dg = rendered[i + 1] - target[i + 1];
    const db = rendered[i + 2] - target[i + 2];
    sumSqError += dr * dr + dg * dg + db * db;
  }
  const numPixels = n / 4;
  return -(sumSqError / (numPixels * 3)); // normalize by pixels and channels
}

/**
 * Create a polygon-art fitness function.
 * @param {Uint8ClampedArray} targetPixels — target image pixel data
 * @param {number} numPolygons
 * @param {number} verticesPerPoly
 * @param {number} width
 * @param {number} height
 * @returns {Function} fitness function for gene arrays
 */
export function createPolygonFitness(targetPixels, numPolygons, verticesPerPoly, width, height) {
  return (genes) => {
    const polygons = decodePolygons(genes, numPolygons, verticesPerPoly);
    const rendered = renderPolygons(polygons, width, height);
    return pixelFitness(rendered, targetPixels);
  };
}

/**
 * Specialized mutation for polygon genomes.
 * Mutates individual gene values with Gaussian noise, clamped to [0, 1].
 */
export function polygonMutation(ind, rate, rng, sigma = 0.1) {
  const genes = [...ind.genes];
  for (let i = 0; i < genes.length; i++) {
    if (rng.chance(rate)) {
      genes[i] = Math.min(1, Math.max(0, genes[i] + rng.gaussian() * sigma));
    }
  }
  return new Individual(genes);
}
