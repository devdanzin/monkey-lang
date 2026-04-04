// ===== Probabilistic Data Structures =====
//
// 1. Bloom Filter — set membership with false positives but no false negatives
// 2. Count-Min Sketch — frequency estimation with overcount but no undercount
// 3. HyperLogLog — cardinality estimation using harmonic mean of hash buckets

// ===== Hash functions =====
// Simple but effective hash functions using FNV-1a variants

function fnv1a(str, seed = 0) {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function hashN(item, n) {
  const str = typeof item === 'string' ? item : String(item);
  // Generate n independent hashes using double hashing
  const h1 = fnv1a(str, 0);
  const h2 = fnv1a(str, h1);
  const hashes = [];
  for (let i = 0; i < n; i++) {
    hashes.push(((h1 + i * h2) >>> 0));
  }
  return hashes;
}

// ===== Bloom Filter =====

export class BloomFilter {
  constructor(size = 1024, numHashes = 7) {
    this.size = size;
    this.numHashes = numHashes;
    this.bits = new Uint8Array(Math.ceil(size / 8));
    this._count = 0;
  }

  _setBit(index) {
    const byte = index >>> 3;
    const bit = index & 7;
    this.bits[byte] |= (1 << bit);
  }

  _getBit(index) {
    const byte = index >>> 3;
    const bit = index & 7;
    return (this.bits[byte] >>> bit) & 1;
  }

  add(item) {
    const hashes = hashN(item, this.numHashes);
    for (const h of hashes) {
      this._setBit(h % this.size);
    }
    this._count++;
  }

  // May return true for items not added (false positive)
  // Never returns false for items that were added
  has(item) {
    const hashes = hashN(item, this.numHashes);
    for (const h of hashes) {
      if (!this._getBit(h % this.size)) return false;
    }
    return true; // probably in the set
  }

  get count() { return this._count; }

  // Estimated false positive rate
  get falsePositiveRate() {
    const m = this.size;
    const k = this.numHashes;
    const n = this._count;
    return Math.pow(1 - Math.exp(-k * n / m), k);
  }

  // Create with optimal parameters for expected items and FP rate
  static optimal(expectedItems, fpRate = 0.01) {
    const m = Math.ceil(-expectedItems * Math.log(fpRate) / (Math.log(2) ** 2));
    const k = Math.round((m / expectedItems) * Math.log(2));
    return new BloomFilter(m, Math.max(1, k));
  }
}

// ===== Count-Min Sketch =====

export class CountMinSketch {
  constructor(width = 1024, depth = 5) {
    this.width = width;
    this.depth = depth;
    this.table = Array.from({ length: depth }, () => new Int32Array(width));
    this._totalCount = 0;
  }

  add(item, count = 1) {
    const hashes = hashN(item, this.depth);
    for (let d = 0; d < this.depth; d++) {
      this.table[d][hashes[d] % this.width] += count;
    }
    this._totalCount += count;
  }

  // Returns estimated count (may overcount, never undercounts)
  estimate(item) {
    const hashes = hashN(item, this.depth);
    let min = Infinity;
    for (let d = 0; d < this.depth; d++) {
      const count = this.table[d][hashes[d] % this.width];
      if (count < min) min = count;
    }
    return min;
  }

  get totalCount() { return this._totalCount; }

  // Create with optimal parameters for error tolerance
  static optimal(epsilon, delta) {
    const width = Math.ceil(Math.E / epsilon);
    const depth = Math.ceil(Math.log(1 / delta));
    return new CountMinSketch(width, depth);
  }
}

// ===== HyperLogLog =====

export class HyperLogLog {
  constructor(precision = 14) {
    this.p = precision;                    // precision bits
    this.m = 1 << precision;              // number of registers
    this.registers = new Uint8Array(this.m);
    this.alpha = this._getAlpha();
  }

  _getAlpha() {
    const m = this.m;
    if (m === 16) return 0.673;
    if (m === 32) return 0.697;
    if (m === 64) return 0.709;
    return 0.7213 / (1 + 1.079 / m);
  }

  add(item) {
    const str = typeof item === 'string' ? item : String(item);
    const hash = fnv1a(str, 42) >>> 0;
    
    // First p bits determine the register
    const registerIndex = hash >>> (32 - this.p);
    
    // Remaining bits: count leading zeros + 1
    const remaining = (hash << this.p) >>> 0;
    const leadingZeros = remaining === 0 ? 32 - this.p : Math.clz32(remaining) + 1;
    
    // Update register with max
    if (leadingZeros > this.registers[registerIndex]) {
      this.registers[registerIndex] = leadingZeros;
    }
  }

  // Estimate cardinality
  estimate() {
    // Raw estimate using harmonic mean
    let sum = 0;
    let zeroCount = 0;
    
    for (let i = 0; i < this.m; i++) {
      sum += Math.pow(2, -this.registers[i]);
      if (this.registers[i] === 0) zeroCount++;
    }
    
    let estimate = this.alpha * this.m * this.m / sum;
    
    // Small range correction
    if (estimate <= 2.5 * this.m && zeroCount > 0) {
      estimate = this.m * Math.log(this.m / zeroCount);
    }
    
    // Large range correction
    const twoTo32 = Math.pow(2, 32);
    if (estimate > twoTo32 / 30) {
      estimate = -twoTo32 * Math.log(1 - estimate / twoTo32);
    }
    
    return Math.round(estimate);
  }

  // Merge two HyperLogLog instances
  merge(other) {
    if (this.p !== other.p) throw new Error('Cannot merge HLLs with different precision');
    for (let i = 0; i < this.m; i++) {
      if (other.registers[i] > this.registers[i]) {
        this.registers[i] = other.registers[i];
      }
    }
  }
}
