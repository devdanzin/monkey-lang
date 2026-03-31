import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, encodeBinary, decodeBinary, compressionRatio } from '../src/index.js';

describe('encode', () => {
  it('basic', () => assert.equal(encode('AAABBC'), '3A2BC'));
  it('no runs', () => assert.equal(encode('ABC'), 'ABC'));
  it('single char', () => assert.equal(encode('AAAA'), '4A'));
  it('empty', () => assert.equal(encode(''), ''));
});

describe('decode', () => {
  it('basic', () => assert.equal(decode('3A2BC'), 'AAABBC'));
  it('no numbers', () => assert.equal(decode('ABC'), 'ABC'));
  it('large count', () => assert.equal(decode('10A'), 'AAAAAAAAAA'));
  it('empty', () => assert.equal(decode(''), ''));
});

describe('roundtrip', () => {
  it('encode then decode', () => {
    const original = 'WWWWWBBBWWRR';
    assert.equal(decode(encode(original)), original);
  });
});

describe('binary', () => {
  it('roundtrip', () => {
    const original = new Uint8Array([1, 1, 1, 2, 2, 3]);
    const encoded = encodeBinary(original);
    const decoded = decodeBinary(encoded);
    assert.deepEqual(decoded, original);
  });
  it('single byte repeated', () => {
    const original = new Uint8Array(100).fill(42);
    const encoded = encodeBinary(original);
    assert.ok(encoded.length < original.length);
    assert.deepEqual(decodeBinary(encoded), original);
  });
});

describe('compression', () => {
  it('repetitive text compresses', () => assert.ok(compressionRatio('AAAAAAAAA') > 0));
  it('random text may expand', () => assert.ok(compressionRatio('ABCDEF') <= 0));
});
