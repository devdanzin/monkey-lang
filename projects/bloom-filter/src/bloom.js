// Bloom Filter — space-efficient probabilistic set membership

export class BloomFilter {
  constructor(size = 1024, hashCount = 3) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
    this._count = 0;
  }

  // Optimal params for n items and false positive rate p
  static optimal(n, p = 0.01) {
    const m = Math.ceil(-n * Math.log(p) / (Math.log(2) ** 2));
    const k = Math.round((m / n) * Math.log(2));
    return new BloomFilter(m, Math.max(1, k));
  }

  add(item) {
    for (const idx of this._hashes(item)) {
      this.bits[idx >> 3] |= (1 << (idx & 7));
    }
    this._count++;
    return this;
  }

  // Might return true for items not added (false positive), never false for added items
  has(item) {
    for (const idx of this._hashes(item)) {
      if (!(this.bits[idx >> 3] & (1 << (idx & 7)))) return false;
    }
    return true; // Probably in set
  }

  // Approximate count of items added
  get count() { return this._count; }

  // Estimated false positive rate
  get falsePositiveRate() {
    const setBits = this._setBitCount();
    return Math.pow(setBits / this.size, this.hashCount);
  }

  // Number of bits set
  _setBitCount() {
    let count = 0;
    for (const byte of this.bits) {
      let b = byte;
      while (b) { count += b & 1; b >>= 1; }
    }
    return count;
  }

  // Merge two bloom filters (union)
  merge(other) {
    if (this.size !== other.size || this.hashCount !== other.hashCount) {
      throw new Error('Bloom filters must have same size and hash count');
    }
    const merged = new BloomFilter(this.size, this.hashCount);
    for (let i = 0; i < this.bits.length; i++) {
      merged.bits[i] = this.bits[i] | other.bits[i];
    }
    return merged;
  }

  // Clear
  clear() {
    this.bits.fill(0);
    this._count = 0;
  }

  // Hash functions (FNV-1a variants with different seeds)
  _hashes(item) {
    const str = String(item);
    const indices = [];
    for (let seed = 0; seed < this.hashCount; seed++) {
      let hash = 2166136261 ^ seed;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
      }
      indices.push(hash % this.size);
    }
    return indices;
  }
}
