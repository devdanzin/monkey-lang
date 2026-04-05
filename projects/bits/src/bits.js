// bits.js — Bit manipulation

// ===== Utility functions =====
export function popcount(n) { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; }
export function clz32(n) { if (n === 0) return 32; let c = 0; if (!(n & 0xFFFF0000)) { c += 16; n <<= 16; } if (!(n & 0xFF000000)) { c += 8; n <<= 8; } if (!(n & 0xF0000000)) { c += 4; n <<= 4; } if (!(n & 0xC0000000)) { c += 2; n <<= 2; } if (!(n & 0x80000000)) c++; return c; }
export function ctz32(n) { if (n === 0) return 32; let c = 0; while (!(n & 1)) { c++; n >>>= 1; } return c; }
export function isPowerOf2(n) { return n > 0 && (n & (n - 1)) === 0; }
export function nextPowerOf2(n) { if (n <= 1) return 1; n--; n |= n >> 1; n |= n >> 2; n |= n >> 4; n |= n >> 8; n |= n >> 16; return n + 1; }
export function reverseBits(n, bits = 32) { let r = 0; for (let i = 0; i < bits; i++) { r = (r << 1) | (n & 1); n >>>= 1; } return r >>> 0; }
export function rotateLeft(n, shift, bits = 32) { return ((n << shift) | (n >>> (bits - shift))) >>> 0; }
export function rotateRight(n, shift, bits = 32) { return ((n >>> shift) | (n << (bits - shift))) >>> 0; }
export function hammingDistance(a, b) { return popcount(a ^ b); }
export function getBit(n, pos) { return (n >>> pos) & 1; }
export function setBit(n, pos) { return (n | (1 << pos)) >>> 0; }
export function clearBit(n, pos) { return (n & ~(1 << pos)) >>> 0; }
export function toggleBit(n, pos) { return (n ^ (1 << pos)) >>> 0; }
export function swapBits(n, i, j) { const bi = getBit(n, i), bj = getBit(n, j); if (bi !== bj) { n = toggleBit(n, i); n = toggleBit(n, j); } return n; }

// ===== BitSet =====
export class BitSet {
  constructor(size = 32) { this.words = new Uint32Array(Math.ceil(size / 32)); this.size = size; }

  set(pos) { this.words[pos >>> 5] |= 1 << (pos & 31); return this; }
  clear(pos) { this.words[pos >>> 5] &= ~(1 << (pos & 31)); return this; }
  test(pos) { return (this.words[pos >>> 5] & (1 << (pos & 31))) !== 0; }
  toggle(pos) { this.words[pos >>> 5] ^= 1 << (pos & 31); return this; }
  
  count() { let c = 0; for (const w of this.words) c += popcount(w); return c; }
  
  toArray() { const a = []; for (let i = 0; i < this.size; i++) if (this.test(i)) a.push(i); return a; }
  
  union(other) { const r = new BitSet(Math.max(this.size, other.size)); for (let i = 0; i < r.words.length; i++) r.words[i] = (this.words[i] || 0) | (other.words[i] || 0); return r; }
  intersection(other) { const r = new BitSet(Math.min(this.size, other.size)); for (let i = 0; i < r.words.length; i++) r.words[i] = (this.words[i] || 0) & (other.words[i] || 0); return r; }
  xor(other) { const r = new BitSet(Math.max(this.size, other.size)); for (let i = 0; i < r.words.length; i++) r.words[i] = (this.words[i] || 0) ^ (other.words[i] || 0); return r; }
  
  equals(other) { const len = Math.max(this.words.length, other.words.length); for (let i = 0; i < len; i++) if ((this.words[i] || 0) !== (other.words[i] || 0)) return false; return true; }
  
  toString() { let s = ''; for (let i = this.size - 1; i >= 0; i--) s += this.test(i) ? '1' : '0'; return s; }
  
  static fromArray(bits, size) { const bs = new BitSet(size || Math.max(...bits) + 1); for (const b of bits) bs.set(b); return bs; }
}
