import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bilateralFilter, boxBlur } from '../src/denoise.js';

describe('bilateralFilter', () => {
  it('preserves uniform image', () => {
    // All same color — should stay the same
    const w = 4, h = 4;
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 128; pixels[i+1] = 64; pixels[i+2] = 32; pixels[i+3] = 255;
    }
    const result = bilateralFilter(pixels, w, h, 2, 25);
    for (let i = 0; i < result.length; i += 4) {
      assert.equal(result[i], 128);
      assert.equal(result[i+1], 64);
      assert.equal(result[i+2], 32);
    }
  });

  it('smooths noisy image', () => {
    const w = 10, h = 10;
    const pixels = new Uint8ClampedArray(w * h * 4);
    // Create noisy image (alternating bright/dark)
    for (let i = 0; i < w * h; i++) {
      const val = (i % 2 === 0) ? 200 : 100;
      pixels[i*4] = val; pixels[i*4+1] = val; pixels[i*4+2] = val; pixels[i*4+3] = 255;
    }
    const result = bilateralFilter(pixels, w, h, 3, 100);
    // Result should be smoother — check center pixels are more average
    // The bilateral filter should bring 200 and 100 closer to 150
    let maxDiff = 0;
    for (let i = 4 * w; i < (w * h - w) * 4; i += 4) { // Skip edges
      maxDiff = Math.max(maxDiff, Math.abs(result[i] - 150));
    }
    assert.ok(maxDiff < 50, `Max diff from mean should be < 50, got ${maxDiff}`);
  });

  it('preserves sharp edges', () => {
    const w = 10, h = 2;
    const pixels = new Uint8ClampedArray(w * h * 4);
    // Left half black, right half white (sharp edge at x=5)
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const val = x < 5 ? 0 : 255;
        const i = (y * w + x) * 4;
        pixels[i] = val; pixels[i+1] = val; pixels[i+2] = val; pixels[i+3] = 255;
      }
    }
    const result = bilateralFilter(pixels, w, h, 1, 10);
    // Far from edge, values should be preserved
    assert.ok(result[0] < 50, 'Far black should stay dark');
    assert.ok(result[(w-1)*4] > 200, 'Far white should stay bright');
  });
});

describe('boxBlur', () => {
  it('averages neighbors', () => {
    const w = 3, h = 3;
    const pixels = new Uint8ClampedArray(w * h * 4);
    // Center pixel bright, rest dark
    const center = (1 * w + 1) * 4;
    pixels[center] = 255; pixels[center+1] = 255; pixels[center+2] = 255; pixels[center+3] = 255;
    const result = boxBlur(pixels, w, h, 1);
    // Center should be dimmed (averaged with 8 dark neighbors)
    assert.ok(result[center] < 100);
    assert.ok(result[center] > 0);
  });
});
