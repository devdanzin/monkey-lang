import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as bits from '../src/index.js';

describe('popcount', () => {
  it('counts set bits', () => { assert.equal(bits.popcount(0), 0); assert.equal(bits.popcount(1), 1); assert.equal(bits.popcount(7), 3); assert.equal(bits.popcount(255), 8); });
});
describe('isPowerOf2', () => {
  it('checks', () => { assert.equal(bits.isPowerOf2(1), true); assert.equal(bits.isPowerOf2(2), true); assert.equal(bits.isPowerOf2(3), false); assert.equal(bits.isPowerOf2(16), true); assert.equal(bits.isPowerOf2(0), false); });
});
describe('nextPowerOf2', () => {
  it('finds next', () => { assert.equal(bits.nextPowerOf2(5), 8); assert.equal(bits.nextPowerOf2(8), 8); assert.equal(bits.nextPowerOf2(1), 1); });
});
describe('get/set/clear/toggle', () => {
  it('manipulates bits', () => {
    assert.equal(bits.getBit(5, 0), 1); // 101 → bit 0 = 1
    assert.equal(bits.getBit(5, 1), 0); // 101 → bit 1 = 0
    assert.equal(bits.setBit(4, 0), 5); // 100 → 101
    assert.equal(bits.clearBit(5, 0), 4); // 101 → 100
    assert.equal(bits.toggleBit(5, 1), 7); // 101 → 111
  });
});
describe('clz/ctz', () => {
  it('counts zeros', () => { assert.equal(bits.clz(1), 31); assert.equal(bits.ctz(4), 2); assert.equal(bits.clz(0), 32); assert.equal(bits.ctz(0), 32); });
});
describe('reverseBits', () => {
  it('reverses', () => { assert.equal(bits.reverseBits(1), 0x80000000 >>> 0); });
});
describe('log2', () => {
  it('floor log2', () => { assert.equal(bits.log2(1), 0); assert.equal(bits.log2(8), 3); assert.equal(bits.log2(10), 3); });
});
describe('hammingDistance', () => {
  it('counts differing bits', () => { assert.equal(bits.hammingDistance(1, 4), 2); assert.equal(bits.hammingDistance(7, 7), 0); });
});
describe('extractBits', () => {
  it('extracts range', () => { assert.equal(bits.extractBits(0b11010110, 2, 5), 0b0101); });
});
describe('abs/min/max', () => {
  it('branchless ops', () => { assert.equal(bits.abs(-5), 5); assert.equal(bits.abs(5), 5); assert.equal(bits.min(3, 7), 3); assert.equal(bits.max(3, 7), 7); });
});
describe('sign/sameSign', () => {
  it('sign', () => { assert.equal(bits.sign(5), 1); assert.equal(bits.sign(-3), -1); assert.equal(bits.sign(0), 0); });
  it('sameSign', () => { assert.equal(bits.sameSign(3, 5), true); assert.equal(bits.sameSign(-3, 5), false); });
});
describe('toBinary', () => {
  it('formats', () => { assert.equal(bits.toBinary(5, 8), '00000101'); });
});
