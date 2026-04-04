// probabilistic.js — Bloom Filter, Count-Min Sketch, HyperLogLog

import { createHash } from 'node:crypto';

// ===== Hash Functions =====
function hash(value, seed = 0) {
  const h = createHash('md5').update(`${seed}:${value}`).digest();
  return h.readUInt32LE(0);
}

function hashes(value, count) {
  // Double-hashing technique: h(i) = h1 + i * h2
  const h1 = hash(value, 0);
  const h2 = hash(value, 1);
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = (h1 + i * h2) >>> 0;
  }
  return result;
}

// ===== Bloom Filter =====
// Space-efficient set membership test with configurable false positive rate
export class BloomFilter {
  constructor(expectedItems = 1000, falsePositiveRate = 0.01) {
    // Optimal parameters
    this.m = Math.ceil(-expectedItems * Math.log(falsePositiveRate) / (Math.LN2 * Math.LN2));
    this.k = Math.ceil((this.m / expectedItems) * Math.LN2);
    this.bits = new Uint8Array(Math.ceil(this.m / 8));
    this.count = 0;
  }

  add(value) {
    const hs = hashes(String(value), this.k);
    for (const h of hs) {
      const idx = h % this.m;
      this.bits[idx >> 3] |= (1 << (idx & 7));
    }
    this.count++;
  }

  has(value) {
    const hs = hashes(String(value), this.k);
    for (const h of hs) {
      const idx = h % this.m;
      if (!(this.bits[idx >> 3] & (1 << (idx & 7)))) return false;
    }
    return true; // might be false positive
  }

  // Estimated false positive rate given current fill
  estimatedFPRate() {
    const setBits = this._countSetBits();
    return Math.pow(setBits / this.m, this.k);
  }

  _countSetBits() {
    let count = 0;
    for (let i = 0; i < this.bits.length; i++) {
      let byte = this.bits[i];
      while (byte) { count += byte & 1; byte >>= 1; }
    }
    return count;
  }

  get size() { return this.count; }
  get bitCount() { return this.m; }
  get hashCount() { return this.k; }

  // Merge two bloom filters (union)
  static merge(a, b) {
    if (a.m !== b.m || a.k !== b.k) throw new Error('Incompatible bloom filters');
    const result = new BloomFilter(1, 0.01);
    result.m = a.m;
    result.k = a.k;
    result.bits = new Uint8Array(a.bits.length);
    for (let i = 0; i < a.bits.length; i++) {
      result.bits[i] = a.bits[i] | b.bits[i];
    }
    result.count = a.count + b.count;
    return result;
  }
}

// ===== Count-Min Sketch =====
// Frequency estimation with bounded overcount
export class CountMinSketch {
  constructor(width = 1000, depth = 7) {
    this.width = width;
    this.depth = depth;
    this.table = Array.from({ length: depth }, () => new Int32Array(width));
    this.totalCount = 0;
  }

  add(value, count = 1) {
    const hs = hashes(String(value), this.depth);
    for (let i = 0; i < this.depth; i++) {
      this.table[i][hs[i] % this.width] += count;
    }
    this.totalCount += count;
  }

  estimate(value) {
    const hs = hashes(String(value), this.depth);
    let min = Infinity;
    for (let i = 0; i < this.depth; i++) {
      min = Math.min(min, this.table[i][hs[i] % this.width]);
    }
    return min;
  }

  get size() { return this.totalCount; }

  // Merge two sketches
  static merge(a, b) {
    if (a.width !== b.width || a.depth !== b.depth) throw new Error('Incompatible sketches');
    const result = new CountMinSketch(a.width, a.depth);
    for (let i = 0; i < a.depth; i++) {
      for (let j = 0; j < a.width; j++) {
        result.table[i][j] = a.table[i][j] + b.table[i][j];
      }
    }
    result.totalCount = a.totalCount + b.totalCount;
    return result;
  }
}

// ===== HyperLogLog =====
// Cardinality estimation using stochastic averaging
export class HyperLogLog {
  constructor(precision = 14) {
    this.p = precision;
    this.m = 1 << precision; // number of registers
    this.registers = new Uint8Array(this.m);
    this.alpha = this._alpha();
  }

  _alpha() {
    if (this.m === 16) return 0.673;
    if (this.m === 32) return 0.697;
    if (this.m === 64) return 0.709;
    return 0.7213 / (1 + 1.079 / this.m);
  }

  add(value) {
    const h = hash(String(value), 42);
    const j = h & (this.m - 1); // register index (low bits)
    const w = h >>> this.p;     // remaining bits
    // Count leading zeros + 1
    const rho = w === 0 ? 32 - this.p + 1 : Math.clz32(w) - this.p + 1;
    this.registers[j] = Math.max(this.registers[j], rho);
  }

  estimate() {
    // Harmonic mean of 2^registers
    let sum = 0;
    let zeros = 0;
    for (let i = 0; i < this.m; i++) {
      sum += Math.pow(2, -this.registers[i]);
      if (this.registers[i] === 0) zeros++;
    }

    let estimate = this.alpha * this.m * this.m / sum;

    // Small range correction
    if (estimate <= 2.5 * this.m && zeros > 0) {
      estimate = this.m * Math.log(this.m / zeros);
    }

    // Large range correction
    const pow2_32 = Math.pow(2, 32);
    if (estimate > pow2_32 / 30) {
      estimate = -pow2_32 * Math.log(1 - estimate / pow2_32);
    }

    return Math.round(estimate);
  }

  // Merge two HLLs
  static merge(a, b) {
    if (a.p !== b.p) throw new Error('Incompatible HyperLogLog instances');
    const result = new HyperLogLog(a.p);
    for (let i = 0; i < a.m; i++) {
      result.registers[i] = Math.max(a.registers[i], b.registers[i]);
    }
    return result;
  }
}
