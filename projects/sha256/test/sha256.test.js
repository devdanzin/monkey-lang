import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../src/index.js';

describe('sha256', () => {
  // NIST test vectors
  it('empty string', () => assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'));
  it('abc', () => assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
  it('longer', () => assert.equal(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'));
  it('deterministic', () => assert.equal(sha256('hello'), sha256('hello')));
  it('different inputs differ', () => assert.notEqual(sha256('abc'), sha256('def')));
  it('Uint8Array', () => assert.equal(sha256(new Uint8Array([0x61, 0x62, 0x63])), sha256('abc')));
});
