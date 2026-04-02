import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RNG, Individual, Population,
  genesPerPolygon, genomeLength, decodePolygons, renderPolygons,
  pixelFitness, createPolygonFitness, polygonMutation,
  blendCrossover, gaussianMutation
} from '../src/index.js';

// ─── Encoding ───────────────────────────────────────────────────────────

describe('Polygon encoding', () => {
  it('genesPerPolygon calculates correctly', () => {
    assert.equal(genesPerPolygon(3), 10); // rgba(4) + 3 verts * 2
    assert.equal(genesPerPolygon(4), 12); // rgba(4) + 4 verts * 2
    assert.equal(genesPerPolygon(6), 16); // rgba(4) + 6 verts * 2
  });

  it('genomeLength calculates total genes', () => {
    assert.equal(genomeLength(10, 3), 100); // 10 polys * 10 genes each
    assert.equal(genomeLength(5, 4), 60);   // 5 polys * 12 genes each
  });

  it('decodePolygons extracts correct structure', () => {
    // One triangle: r=0.5, g=0.3, b=0.8, a=0.6, verts at (0.1,0.2), (0.3,0.4), (0.5,0.6)
    const genes = [0.5, 0.3, 0.8, 0.6, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    const polys = decodePolygons(genes, 1, 3);
    assert.equal(polys.length, 1);
    assert.ok(Math.abs(polys[0].r - 0.5) < 1e-10);
    assert.ok(Math.abs(polys[0].g - 0.3) < 1e-10);
    assert.ok(Math.abs(polys[0].b - 0.8) < 1e-10);
    assert.ok(Math.abs(polys[0].a - 0.6) < 1e-10);
    assert.equal(polys[0].vertices.length, 3);
    assert.ok(Math.abs(polys[0].vertices[0][0] - 0.1) < 1e-10);
    assert.ok(Math.abs(polys[0].vertices[2][1] - 0.6) < 1e-10);
  });

  it('decodePolygons handles multiple polygons', () => {
    const genes = new Array(20).fill(0.5); // 2 triangles
    const polys = decodePolygons(genes, 2, 3);
    assert.equal(polys.length, 2);
    assert.equal(polys[0].vertices.length, 3);
    assert.equal(polys[1].vertices.length, 3);
  });
});

// ─── Software Renderer ──────────────────────────────────────────────────

describe('Software renderer', () => {
  it('renders white background with no polygons', () => {
    const pixels = renderPolygons([], 4, 4);
    assert.equal(pixels.length, 64); // 4*4*4
    // All white (255)
    for (let i = 0; i < pixels.length; i++) {
      assert.equal(pixels[i], 255);
    }
  });

  it('renders an opaque polygon', () => {
    // Full-screen red triangle
    const polys = [{
      r: 1, g: 0, b: 0, a: 1,
      vertices: [[0, 0], [1, 0], [0.5, 1]] // covers most of image
    }];
    const pixels = renderPolygons(polys, 10, 10);
    // Center pixel should be red
    const cx = 5, cy = 5;
    const idx = (cy * 10 + cx) * 4;
    assert.equal(pixels[idx], 255);     // R
    assert.equal(pixels[idx + 1], 0);   // G
    assert.equal(pixels[idx + 2], 0);   // B
    assert.equal(pixels[idx + 3], 255); // A
  });

  it('alpha blends semi-transparent polygon', () => {
    // 50% transparent blue over white background
    const polys = [{
      r: 0, g: 0, b: 1, a: 0.5,
      vertices: [[0, 0], [1, 0], [1, 1], [0, 1]] // full cover quad
    }];
    const pixels = renderPolygons(polys, 4, 4);
    const idx = (2 * 4 + 2) * 4; // center pixel
    // Blue 0.5 over white: R = 0*0.5 + 255*0.5 = 128
    assert.ok(Math.abs(pixels[idx] - 128) <= 1);     // R ≈ 128
    assert.ok(Math.abs(pixels[idx + 1] - 128) <= 1); // G ≈ 128
    assert.ok(Math.abs(pixels[idx + 2] - 255) <= 1); // B ≈ 255
  });

  it('composites multiple polygons in order', () => {
    const polys = [
      { r: 1, g: 0, b: 0, a: 1, vertices: [[0,0],[1,0],[1,1],[0,1]] }, // red
      { r: 0, g: 0, b: 1, a: 0.5, vertices: [[0,0],[1,0],[1,1],[0,1]] }, // 50% blue over red
    ];
    const pixels = renderPolygons(polys, 4, 4);
    const idx = (1 * 4 + 1) * 4;
    // Red then 50% blue: R = 0*0.5 + 255*0.5 = 128, G = 0, B = 0*0.5+0*0.5... wait
    // Red pixel after first poly: (255, 0, 0)
    // After 50% blue: R = 0*0.5 + 255*0.5 = 128, G = 0, B = 255*0.5 + 0*0.5 = 128
    assert.ok(Math.abs(pixels[idx] - 128) <= 1);     // R ≈ 128
    assert.ok(Math.abs(pixels[idx + 1] - 0) <= 1);   // G ≈ 0
    assert.ok(Math.abs(pixels[idx + 2] - 128) <= 1); // B ≈ 128
  });
});

// ─── Fitness ────────────────────────────────────────────────────────────

describe('Pixel fitness', () => {
  it('perfect match gives fitness 0', () => {
    const target = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const f = pixelFitness(target, target);
    assert.ok(Math.abs(f) < 1e-10);
  });

  it('all black vs all white gives large negative fitness', () => {
    const black = new Uint8ClampedArray(16).fill(0);
    const white = new Uint8ClampedArray(16).fill(255);
    const f = pixelFitness(black, white);
    assert.ok(f < -10000, `Expected very negative, got ${f}`);
  });

  it('closer images have higher fitness', () => {
    const target = new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 255]);
    const close = new Uint8ClampedArray([130, 130, 130, 255, 126, 126, 126, 255]);
    const far = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    assert.ok(pixelFitness(close, target) > pixelFitness(far, target));
  });
});

// ─── Polygon Fitness Function ───────────────────────────────────────────

describe('createPolygonFitness', () => {
  it('creates a working fitness function', () => {
    // 4x4 red image as target
    const target = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < target.length; i += 4) {
      target[i] = 255; target[i + 1] = 0; target[i + 2] = 0; target[i + 3] = 255;
    }
    const fit = createPolygonFitness(target, 1, 3, 4, 4);
    
    // Random genome
    const rng = new RNG(400);
    const genes = Array.from({ length: genomeLength(1, 3) }, () => rng.random());
    const f = fit(genes);
    assert.ok(typeof f === 'number');
    assert.ok(f <= 0); // MSE is always >= 0, negated
  });

  it('all-red polygon on red target gets better fitness', () => {
    const target = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < target.length; i += 4) {
      target[i] = 255; target[i+1] = 0; target[i+2] = 0; target[i+3] = 255;
    }
    const fit = createPolygonFitness(target, 1, 4, 8, 8);
    
    // Red quad covering full image
    const redGenes = [1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]; // rgba + 4 corners
    // Random genes
    const rng = new RNG(401);
    const randGenes = Array.from({ length: 12 }, () => rng.random());
    
    assert.ok(fit(redGenes) > fit(randGenes), 'Red polygon should match red target better');
  });
});

// ─── Polygon Mutation ───────────────────────────────────────────────────

describe('polygonMutation', () => {
  it('mutates genes within [0, 1]', () => {
    const rng = new RNG(410);
    const ind = new Individual(Array.from({ length: 30 }, () => 0.5));
    const mutated = polygonMutation(ind, 0.5, rng, 0.1);
    assert.ok(mutated.genes.every(g => g >= 0 && g <= 1));
    assert.ok(mutated.genes.some(g => g !== 0.5)); // some should have changed
  });

  it('with rate=0 preserves all genes', () => {
    const rng = new RNG(411);
    const genes = [0.1, 0.2, 0.3, 0.4, 0.5];
    const ind = new Individual(genes);
    const mutated = polygonMutation(ind, 0, rng, 0.1);
    assert.deepEqual(mutated.genes, genes);
  });
});

// ─── Integration: Evolution ─────────────────────────────────────────────

describe('Polygon art evolution', () => {
  it('evolves toward a simple target (red 8x8)', () => {
    const rng = new RNG(420);
    
    // Target: solid red 8x8
    const target = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < target.length; i += 4) {
      target[i] = 255; target[i+1] = 0; target[i+2] = 0; target[i+3] = 255;
    }
    
    const numPolys = 3;
    const verts = 3;
    const gLen = genomeLength(numPolys, verts);
    const fit = createPolygonFitness(target, numPolys, verts, 8, 8);

    const pop = new Population({
      size: 30,
      createIndividual: () => Individual.randomReal(gLen, 0, 1, rng),
      fitness: fit,
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.3),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => polygonMutation(ind, rate, rng, 0.1),
        rate: 0.3
      },
      elitism: 2,
      rng
    });

    // Get initial fitness
    pop.evaluate();
    const initialBest = pop.getBest().fitness;

    const result = pop.run(50);

    // Should improve from initial
    assert.ok(result.bestEver.fitness > initialBest, 
      `Expected improvement: ${result.bestEver.fitness} > ${initialBest}`);
  });

  it('evolves with gradient pattern target', () => {
    const rng = new RNG(421);
    
    // Target: horizontal gradient (black to white)
    const w = 8, h = 8;
    const target = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = Math.round((x / (w - 1)) * 255);
        const idx = (y * w + x) * 4;
        target[idx] = v; target[idx+1] = v; target[idx+2] = v; target[idx+3] = 255;
      }
    }

    const numPolys = 5;
    const gLen = genomeLength(numPolys, 3);
    const fit = createPolygonFitness(target, numPolys, 3, w, h);

    const pop = new Population({
      size: 40,
      createIndividual: () => Individual.randomReal(gLen, 0, 1, rng),
      fitness: fit,
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.3),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => polygonMutation(ind, rate, rng, 0.1),
        rate: 0.3
      },
      elitism: 2,
      rng
    });

    pop.evaluate();
    const initialBest = pop.getBest().fitness;
    const result = pop.run(100);
    assert.ok(result.bestEver.fitness > initialBest);
  });
});
