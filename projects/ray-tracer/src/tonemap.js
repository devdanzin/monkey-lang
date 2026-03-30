// tonemap.js — Tone mapping for HDR to LDR conversion

/**
 * Reinhard tone mapping: simple, preserves details
 * L_out = L / (1 + L)
 */
export function reinhardToneMap(pixels, width, height) {
  const output = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    // Convert from gamma space back to linear
    let r = (pixels[i] / 255) ** 2;
    let g = (pixels[i + 1] / 255) ** 2;
    let b = (pixels[i + 2] / 255) ** 2;

    // Reinhard
    r = r / (1 + r);
    g = g / (1 + g);
    b = b / (1 + b);

    // Back to gamma and 8-bit
    output[i] = Math.round(Math.sqrt(r) * 255);
    output[i + 1] = Math.round(Math.sqrt(g) * 255);
    output[i + 2] = Math.round(Math.sqrt(b) * 255);
    output[i + 3] = 255;
  }
  return output;
}

/**
 * ACES filmic tone mapping — the Hollywood standard
 * Based on the ACES approximation by Krzysztof Narkowicz
 */
export function acesToneMap(pixels, width, height) {
  const output = new Uint8ClampedArray(pixels.length);
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;

  for (let i = 0; i < pixels.length; i += 4) {
    // Convert from gamma space back to linear
    let r = (pixels[i] / 255) ** 2;
    let g = (pixels[i + 1] / 255) ** 2;
    let bl = (pixels[i + 2] / 255) ** 2;

    // ACES
    r = Math.max(0, Math.min(1, (r * (a * r + b)) / (r * (c * r + d) + e)));
    g = Math.max(0, Math.min(1, (g * (a * g + b)) / (g * (c * g + d) + e)));
    bl = Math.max(0, Math.min(1, (bl * (a * bl + b)) / (bl * (c * bl + d) + e)));

    // Back to gamma and 8-bit
    output[i] = Math.round(Math.sqrt(r) * 255);
    output[i + 1] = Math.round(Math.sqrt(g) * 255);
    output[i + 2] = Math.round(Math.sqrt(bl) * 255);
    output[i + 3] = 255;
  }
  return output;
}

/**
 * Exposure adjustment
 */
export function adjustExposure(pixels, width, height, exposure) {
  const output = new Uint8ClampedArray(pixels.length);
  const multiplier = Math.pow(2, exposure);

  for (let i = 0; i < pixels.length; i += 4) {
    let r = (pixels[i] / 255) ** 2 * multiplier;
    let g = (pixels[i + 1] / 255) ** 2 * multiplier;
    let b = (pixels[i + 2] / 255) ** 2 * multiplier;

    output[i] = Math.round(Math.min(1, Math.sqrt(r)) * 255);
    output[i + 1] = Math.round(Math.min(1, Math.sqrt(g)) * 255);
    output[i + 2] = Math.round(Math.min(1, Math.sqrt(b)) * 255);
    output[i + 3] = 255;
  }
  return output;
}
