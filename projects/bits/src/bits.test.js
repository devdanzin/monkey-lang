import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  popcount, clz32, ctz32, isPowerOf2, nextPowerOf2, reverseBits,
  rotateLeft, rotateRight, hammingDistance, getBit, setBit, clearBit, toggleBit, swapBits,
  BitSet,
} from './bits.js';

describe('popcount', () => {
  it('0', () => { assert.equal(popcount(0), 0); });
  it('1', () => { assert.equal(popcount(1), 1); });
  it('0xFF', () => { assert.equal(popcount(0xFF), 8); });
  it('0xAAAA', () => { assert.equal(popcount(0xAAAA), 8); });
});

describe('clz32', () => {
  it('0', () => { assert.equal(clz32(0), 32); });
  it('1', () => { assert.equal(clz32(1), 31); });
  it('0x80000000', () => { assert.equal(clz32(0x80000000), 0); });
});

describe('ctz32', () => {
  it('0', () => { assert.equal(ctz32(0), 32); });
  it('1', () => { assert.equal(ctz32(1), 0); });
  it('8', () => { assert.equal(ctz32(8), 3); });
});

describe('isPowerOf2', () => {
  it('powers of 2', () => { assert.ok(isPowerOf2(1)); assert.ok(isPowerOf2(2)); assert.ok(isPowerOf2(1024)); });
  it('not powers', () => { assert.ok(!isPowerOf2(0)); assert.ok(!isPowerOf2(3)); assert.ok(!isPowerOf2(6)); });
});

describe('nextPowerOf2', () => {
  it('exact power', () => { assert.equal(nextPowerOf2(4), 4); });
  it('round up', () => { assert.equal(nextPowerOf2(5), 8); assert.equal(nextPowerOf2(100), 128); });
});

describe('reverseBits', () => {
  it('8-bit', () => { assert.equal(reverseBits(0b10110000, 8), 0b00001101); });
});

describe('rotate', () => {
  it('rotateLeft', () => { const r = rotateLeft(1, 1, 8); assert.equal(r & 0xFF, 2); });
  it('rotateRight', () => { const r = rotateRight(2, 1, 32); assert.equal(r, 1); });
});

describe('hammingDistance', () => {
  it('same', () => { assert.equal(hammingDistance(0, 0), 0); });
  it('diff', () => { assert.equal(hammingDistance(0b1010, 0b0101), 4); });
  it('one bit', () => { assert.equal(hammingDistance(0, 1), 1); });
});

describe('getBit/setBit/clearBit/toggleBit', () => {
  it('getBit', () => { assert.equal(getBit(0b1010, 1), 1); assert.equal(getBit(0b1010, 0), 0); });
  it('setBit', () => { assert.equal(setBit(0, 3), 8); });
  it('clearBit', () => { assert.equal(clearBit(0xFF, 0), 0xFE); });
  it('toggleBit', () => { assert.equal(toggleBit(0, 5), 32); assert.equal(toggleBit(32, 5), 0); });
});

describe('swapBits', () => {
  it('swaps', () => { assert.equal(swapBits(0b01, 0, 1), 0b10); });
  it('same bits no change', () => { assert.equal(swapBits(0b11, 0, 1), 0b11); });
});

describe('BitSet', () => {
  it('set and test', () => { const bs = new BitSet(64); bs.set(5); assert.ok(bs.test(5)); assert.ok(!bs.test(4)); });
  it('clear', () => { const bs = new BitSet(32); bs.set(3); bs.clear(3); assert.ok(!bs.test(3)); });
  it('toggle', () => { const bs = new BitSet(32); bs.toggle(7); assert.ok(bs.test(7)); bs.toggle(7); assert.ok(!bs.test(7)); });
  it('count', () => { const bs = new BitSet(64); bs.set(1).set(5).set(10); assert.equal(bs.count(), 3); });
  it('toArray', () => { const bs = new BitSet(16); bs.set(2).set(5).set(8); assert.deepStrictEqual(bs.toArray(), [2, 5, 8]); });
  it('union', () => { const a = BitSet.fromArray([1,3]); const b = BitSet.fromArray([2,3]); assert.deepStrictEqual(a.union(b).toArray(), [1,2,3]); });
  it('intersection', () => { const a = BitSet.fromArray([1,3,5]); const b = BitSet.fromArray([3,5,7]); assert.deepStrictEqual(a.intersection(b).toArray(), [3,5]); });
  it('xor', () => { const a = BitSet.fromArray([1,3]); const b = BitSet.fromArray([2,3]); assert.deepStrictEqual(a.xor(b).toArray(), [1,2]); });
  it('equals', () => { const a = BitSet.fromArray([1,2,3]); const b = BitSet.fromArray([1,2,3]); assert.ok(a.equals(b)); });
  it('toString', () => { const bs = new BitSet(8); bs.set(0).set(2); assert.equal(bs.toString(), '00000101'); });
  it('fromArray', () => { const bs = BitSet.fromArray([0, 4, 7], 8); assert.deepStrictEqual(bs.toArray(), [0, 4, 7]); });
  it('large BitSet', () => { const bs = new BitSet(1000); bs.set(999); assert.ok(bs.test(999)); assert.equal(bs.count(), 1); });
});
