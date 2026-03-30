// denoise.js — Bilateral filter denoiser for noisy renders

/**
 * Apply a bilateral filter to denoise a rendered image.
 * Preserves edges while smoothing noise.
 *
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @param {number} width
 * @param {number} height
 * @param {number} spatialSigma - Spatial gaussian sigma (kernel radius, default 3)
 * @param {number} colorSigma - Color similarity sigma (default 25)
 * @returns {Uint8ClampedArray} - Denoised pixel data
 */
export function bilateralFilter(pixels, width, height, spatialSigma = 3, colorSigma = 25) {
  const output = new Uint8ClampedArray(pixels.length);
  const radius = Math.ceil(spatialSigma * 2);
  const spatialDenom = 2 * spatialSigma * spatialSigma;
  const colorDenom = 2 * colorSigma * colorSigma;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cr = pixels[idx], cg = pixels[idx + 1], cb = pixels[idx + 2];

      let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const nIdx = (ny * width + nx) * 4;
          const nr = pixels[nIdx], ng = pixels[nIdx + 1], nb = pixels[nIdx + 2];

          // Spatial weight (gaussian)
          const spatialDist = dx * dx + dy * dy;
          const spatialWeight = Math.exp(-spatialDist / spatialDenom);

          // Color similarity weight
          const colorDist = (cr - nr) * (cr - nr) + (cg - ng) * (cg - ng) + (cb - nb) * (cb - nb);
          const colorWeight = Math.exp(-colorDist / colorDenom);

          const weight = spatialWeight * colorWeight;
          sumR += nr * weight;
          sumG += ng * weight;
          sumB += nb * weight;
          sumWeight += weight;
        }
      }

      output[idx] = Math.round(sumR / sumWeight);
      output[idx + 1] = Math.round(sumG / sumWeight);
      output[idx + 2] = Math.round(sumB / sumWeight);
      output[idx + 3] = 255;
    }
  }

  return output;
}

/**
 * Simple box blur (fast, for preview)
 */
export function boxBlur(pixels, width, height, radius = 1) {
  const output = new Uint8ClampedArray(pixels.length);
  const size = (2 * radius + 1) * (2 * radius + 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const idx = (ny * width + nx) * 4;
          r += pixels[idx]; g += pixels[idx + 1]; b += pixels[idx + 2];
          count++;
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = Math.round(r / count);
      output[idx + 1] = Math.round(g / count);
      output[idx + 2] = Math.round(b / count);
      output[idx + 3] = 255;
    }
  }

  return output;
}
