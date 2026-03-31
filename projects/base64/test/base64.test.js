import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, decodeToBytes, isValid } from '../src/index.js';

describe('encode', () => {
  it('empty string', () => assert.equal(encode(''), ''));
  it('hello', () => assert.equal(encode('hello'), 'aGVsbG8='));
  it('hello world', () => assert.equal(encode('hello world'), 'aGVsbG8gd29ybGQ='));
  it('single char', () => assert.equal(encode('a'), 'YQ=='));
  it('two chars', () => assert.equal(encode('ab'), 'YWI='));
  it('three chars (no padding)', () => assert.equal(encode('abc'), 'YWJj'));
  it('matches Node.js btoa', () => { const s = 'The quick brown fox'; assert.equal(encode(s), Buffer.from(s).toString('base64')); });
});

describe('decode', () => {
  it('empty', () => assert.equal(decode(''), ''));
  it('hello', () => assert.equal(decode('aGVsbG8='), 'hello'));
  it('hello world', () => assert.equal(decode('aGVsbG8gd29ybGQ='), 'hello world'));
  it('no padding', () => assert.equal(decode('YWJj'), 'abc'));
});

describe('roundtrip', () => {
  it('encode → decode', () => {
    const strings = ['', 'a', 'ab', 'abc', 'hello world', 'Base64 encoding!', '🎉 Unicode!'];
    for (const s of strings) assert.equal(decode(encode(s)), s);
  });
});

describe('URL-safe', () => {
  it('uses - and _ instead of + and /', () => {
    const encoded = encode('data with +/= chars', { urlSafe: true });
    assert.ok(!encoded.includes('+'));
    assert.ok(!encoded.includes('/'));
  });
  it('roundtrips', () => {
    const s = 'hello world!';
    assert.equal(decode(encode(s, { urlSafe: true }), { urlSafe: true }), s);
  });
});

describe('binary data', () => {
  it('handles Uint8Array', () => {
    const bytes = new Uint8Array([0, 128, 255]);
    const encoded = encode(bytes);
    const decoded = decodeToBytes(encoded);
    assert.deepEqual([...decoded], [0, 128, 255]);
  });
});

describe('isValid', () => {
  it('valid base64', () => { assert.equal(isValid('aGVsbG8='), true); });
  it('invalid', () => { assert.equal(isValid('not valid!'), false); });
});
