// PRNG — deterministic random number generators with seed
export class Xorshift32 {
  constructor(seed = Date.now()) { this._state = seed >>> 0 || 1; }
  next() { let x = this._state; x ^= x << 13; x ^= x >> 17; x ^= x << 5; this._state = x >>> 0; return this._state; }
  float() { return this.next() / 0xFFFFFFFF; }
  int(min = 0, max = 0xFFFFFFFF) { return min + (this.next() % (max - min + 1)); }
}

export class Xorshift128 {
  constructor(seed = Date.now()) { this._s = [seed >>> 0 || 1, (seed * 1103515245 + 12345) >>> 0, (seed * 214013 + 2531011) >>> 0, (seed * 16807) >>> 0]; }
  next() {
    let t = this._s[3]; t ^= t << 11; t ^= t >> 8;
    this._s[3] = this._s[2]; this._s[2] = this._s[1]; this._s[1] = this._s[0];
    t ^= this._s[0]; t ^= this._s[0] >> 19;
    this._s[0] = t >>> 0; return this._s[0];
  }
  float() { return this.next() / 0xFFFFFFFF; }
}

export class LCG {
  constructor(seed = Date.now(), a = 1664525, c = 1013904223, m = 2 ** 32) { this._state = seed >>> 0; this._a = a; this._c = c; this._m = m; }
  next() { this._state = (this._a * this._state + this._c) % this._m; return this._state >>> 0; }
  float() { return this.next() / this._m; }
}

export function seedRandom(seed) {
  const rng = new Xorshift32(seed);
  return () => rng.float();
}
