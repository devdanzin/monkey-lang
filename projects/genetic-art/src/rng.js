/**
 * Random number utilities for genetic algorithms.
 * Uses a seedable PRNG (xoshiro128**) for reproducible results.
 */

export class RNG {
  /**
   * @param {number} [seed] — optional seed; uses Date.now() if omitted
   */
  constructor(seed) {
    seed = seed ?? Date.now();
    // splitmix32 to initialize state from a single seed
    const s = this._splitmix32(seed);
    this.s = [s(), s(), s(), s()];
  }

  _splitmix32(a) {
    return () => {
      a |= 0; a = (a + 0x9e3779b9) | 0;
      let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
      t ^= t >>> 15; t = Math.imul(t, 0x735a2d97);
      t ^= t >>> 15;
      return t >>> 0;
    };
  }

  /** Returns a float in [0, 1) */
  random() {
    const s = this.s;
    const result = Math.imul(s[1] * 5, 7) >>> 0;
    const r = (result >>> 0) / 4294967296;
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t;
    s[3] = (s[3] << 11) | (s[3] >>> 21);
    return r;
  }

  /** Returns integer in [min, max] inclusive */
  randInt(min, max) {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  /** Returns float in [min, max) */
  randFloat(min, max) {
    return min + this.random() * (max - min);
  }

  /** Returns true with given probability */
  chance(p) {
    return this.random() < p;
  }

  /** Pick random element from array */
  pick(arr) {
    return arr[this.randInt(0, arr.length - 1)];
  }

  /** Shuffle array in-place (Fisher-Yates) */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Gaussian random (Box-Muller) with mean=0, std=1 */
  gaussian() {
    let u, v, s;
    do {
      u = this.random() * 2 - 1;
      v = this.random() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    return u * Math.sqrt(-2 * Math.log(s) / s);
  }
}

// Default global RNG instance
let defaultRNG = new RNG();

export function setGlobalRNG(rng) { defaultRNG = rng; }
export function getGlobalRNG() { return defaultRNG; }
