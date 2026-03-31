// BitSet — dense bit array with set operations

export class BitSet {
  constructor(size = 64) {
    this._size = size;
    this._words = new Uint32Array(Math.ceil(size / 32));
  }

  static from(bits) {
    const bs = new BitSet(bits.length);
    for (let i = 0; i < bits.length; i++) { if (bits[i]) bs.set(i); }
    return bs;
  }

  set(i) { this._words[i >>> 5] |= (1 << (i & 31)); return this; }
  clear(i) { this._words[i >>> 5] &= ~(1 << (i & 31)); return this; }
  toggle(i) { this._words[i >>> 5] ^= (1 << (i & 31)); return this; }
  get(i) { return (this._words[i >>> 5] & (1 << (i & 31))) !== 0; }

  get size() { return this._size; }

  get count() {
    let n = 0;
    for (const w of this._words) n += popcount32(w);
    return n;
  }

  and(other) {
    const result = new BitSet(Math.max(this._size, other._size));
    const len = Math.min(this._words.length, other._words.length);
    for (let i = 0; i < len; i++) result._words[i] = this._words[i] & other._words[i];
    return result;
  }

  or(other) {
    const result = new BitSet(Math.max(this._size, other._size));
    for (let i = 0; i < result._words.length; i++) {
      result._words[i] = (this._words[i] || 0) | (other._words[i] || 0);
    }
    return result;
  }

  xor(other) {
    const result = new BitSet(Math.max(this._size, other._size));
    for (let i = 0; i < result._words.length; i++) {
      result._words[i] = (this._words[i] || 0) ^ (other._words[i] || 0);
    }
    return result;
  }

  not() {
    const result = new BitSet(this._size);
    for (let i = 0; i < this._words.length; i++) result._words[i] = ~this._words[i];
    // Mask off excess bits
    const excess = this._size & 31;
    if (excess) result._words[result._words.length - 1] &= (1 << excess) - 1;
    return result;
  }

  isEmpty() { return this._words.every(w => w === 0); }

  equals(other) {
    const len = Math.max(this._words.length, other._words.length);
    for (let i = 0; i < len; i++) {
      if ((this._words[i] || 0) !== (other._words[i] || 0)) return false;
    }
    return true;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this._size; i++) { if (this.get(i)) yield i; }
  }

  toArray() { return [...this]; }
  toString() { return Array.from({ length: this._size }, (_, i) => this.get(i) ? '1' : '0').join(''); }
  clone() { const b = new BitSet(this._size); b._words.set(this._words); return b; }
}

function popcount32(n) {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}
