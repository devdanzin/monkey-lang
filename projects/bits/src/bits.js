// Bit manipulation utilities

// Count set bits (population count)
export function popcount(n) { n = n >>> 0; let count = 0; while (n) { count += n & 1; n >>>= 1; } return count; }

// Check if power of 2
export function isPowerOf2(n) { return n > 0 && (n & (n - 1)) === 0; }

// Next power of 2
export function nextPowerOf2(n) { if (n <= 0) return 1; n--; n |= n >> 1; n |= n >> 2; n |= n >> 4; n |= n >> 8; n |= n >> 16; return n + 1; }

// Get/set/clear/toggle individual bits
export function getBit(n, pos) { return (n >>> pos) & 1; }
export function setBit(n, pos) { return n | (1 << pos); }
export function clearBit(n, pos) { return n & ~(1 << pos); }
export function toggleBit(n, pos) { return n ^ (1 << pos); }

// Count leading/trailing zeros
export function clz(n) { if (n === 0) return 32; let count = 0; n = n >>> 0; while (!(n & 0x80000000)) { count++; n <<= 1; } return count; }
export function ctz(n) { if (n === 0) return 32; let count = 0; n = n >>> 0; while (!(n & 1)) { count++; n >>>= 1; } return count; }

// Reverse bits
export function reverseBits(n) { let result = 0; for (let i = 0; i < 32; i++) { result = (result << 1) | (n & 1); n >>>= 1; } return result >>> 0; }

// Swap two values without temp (XOR swap)
export function xorSwap(a, b) { a ^= b; b ^= a; a ^= b; return [a, b]; }

// Integer log2 (floor)
export function log2(n) { if (n <= 0) return -1; let result = 0; n = n >>> 0; while (n > 1) { result++; n >>>= 1; } return result; }

// Check if nth bit is set
export function isSet(n, pos) { return ((n >>> pos) & 1) === 1; }

// Count different bits between two numbers
export function hammingDistance(a, b) { return popcount(a ^ b); }

// Rotate left/right
export function rotateLeft(n, bits, width = 32) { return ((n << bits) | (n >>> (width - bits))) >>> 0; }
export function rotateRight(n, bits, width = 32) { return ((n >>> bits) | (n << (width - bits))) >>> 0; }

// Extract bit range [lo, hi] inclusive
export function extractBits(n, lo, hi) { const mask = ((1 << (hi - lo + 1)) - 1) << lo; return (n & mask) >>> lo; }

// Absolute value without branching
export function abs(n) { const mask = n >> 31; return (n + mask) ^ mask; }

// Min/max without branching
export function min(a, b) { return b + ((a - b) & ((a - b) >> 31)); }
export function max(a, b) { return a - ((a - b) & ((a - b) >> 31)); }

// Sign of number (-1, 0, 1)
export function sign(n) { return (n > 0) - (n < 0); }

// Check if same sign
export function sameSign(a, b) { return (a ^ b) >= 0; }

// To binary string
export function toBinary(n, width = 32) { return (n >>> 0).toString(2).padStart(width, '0'); }
