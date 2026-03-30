// texture.js — Procedural textures

import { Color, Vec3 } from './vec3.js';

// Solid color
export class SolidColor {
  constructor(color) {
    this.color = color;
  }
  value(u, v, p) {
    return this.color;
  }
}

// Checker pattern — alternating two textures based on position
export class CheckerTexture {
  constructor(even, odd, scale = 10) {
    this.even = even instanceof Vec3 ? new SolidColor(even) : even;
    this.odd = odd instanceof Vec3 ? new SolidColor(odd) : odd;
    this.scale = scale;
  }

  value(u, v, p) {
    const sines = Math.sin(this.scale * p.x)
                * Math.sin(this.scale * p.y)
                * Math.sin(this.scale * p.z);
    return sines < 0 ? this.odd.value(u, v, p) : this.even.value(u, v, p);
  }
}

// Gradient between two colors based on y position
export class GradientTexture {
  constructor(bottom, top) {
    this.bottom = bottom;
    this.top = top;
  }

  value(u, v, p) {
    const t = Math.max(0, Math.min(1, (p.y + 1) * 0.5)); // Normalize y to [0,1]
    return this.bottom.mul(1 - t).add(this.top.mul(t));
  }
}

// Noise-based texture (simple value noise)
export class NoiseTexture {
  constructor(color = new Color(1, 1, 1), scale = 4) {
    this.color = color;
    this.scale = scale;
    // Generate permutation table
    this._perm = [];
    for (let i = 0; i < 256; i++) this._perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._perm[i], this._perm[j]] = [this._perm[j], this._perm[i]];
    }
    this._perm = [...this._perm, ...this._perm]; // Double for wrapping
  }

  _noise(x, y, z) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const w = zf * zf * (3 - 2 * zf);

    const p = this._perm;
    const aaa = p[p[p[xi] + yi] + zi] / 255;
    const aba = p[p[p[xi] + yi + 1] + zi] / 255;
    const aab = p[p[p[xi] + yi] + zi + 1] / 255;
    const abb = p[p[p[xi] + yi + 1] + zi + 1] / 255;
    const baa = p[p[p[xi + 1] + yi] + zi] / 255;
    const bba = p[p[p[xi + 1] + yi + 1] + zi] / 255;
    const bab = p[p[p[xi + 1] + yi] + zi + 1] / 255;
    const bbb = p[p[p[xi + 1] + yi + 1] + zi + 1] / 255;

    // Trilinear interpolation
    const x1 = aaa * (1 - u) + baa * u;
    const x2 = aba * (1 - u) + bba * u;
    const x3 = aab * (1 - u) + bab * u;
    const x4 = abb * (1 - u) + bbb * u;
    const y1 = x1 * (1 - v) + x2 * v;
    const y2 = x3 * (1 - v) + x4 * v;
    return y1 * (1 - w) + y2 * w;
  }

  // Turbulence — layered noise
  _turbulence(p, depth = 7) {
    let accum = 0, weight = 1, temp = p;
    for (let i = 0; i < depth; i++) {
      accum += weight * this._noise(temp.x, temp.y, temp.z);
      weight *= 0.5;
      temp = temp.mul(2);
    }
    return Math.abs(accum);
  }

  value(u, v, p) {
    const n = this._turbulence(p.mul(this.scale));
    return this.color.mul(n);
  }
}

// Marble-like texture using noise
export class MarbleTexture {
  constructor(color = new Color(1, 1, 1), scale = 4) {
    this.noise = new NoiseTexture(color, 1);
    this.scale = scale;
    this.color = color;
  }

  value(u, v, p) {
    const n = 0.5 * (1 + Math.sin(this.scale * p.z + 10 * this.noise._turbulence(p)));
    return this.color.mul(n);
  }
}
