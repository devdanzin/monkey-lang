const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encode, decode, compress, decompress, compressionRatio } = require('../src/index.js');

test('encode/decode roundtrip — simple', () => {
  const input = 'AABABCABAABAB';
  const tokens = encode(input);
  const output = decode(tokens);
  assert.equal(output, input);
});

test('encode/decode roundtrip — repeating', () => {
  const input = 'ABCABCABCABC';
  const tokens = encode(input);
  const output = decode(tokens);
  assert.equal(output, input);
});

test('literals only (no matches)', () => {
  const input = 'ABCDEFG';
  const tokens = encode(input);
  const output = decode(tokens);
  assert.equal(output, input);
});

test('all same characters', () => {
  const input = 'AAAAAAAAAA';
  const tokens = encode(input);
  const output = decode(tokens);
  assert.equal(output, input);
  // Should compress well
  assert.ok(tokens.length < input.length);
});

test('compress/decompress roundtrip', () => {
  const input = 'the quick brown fox jumped over the quick brown dog';
  const compressed = compress(input);
  const output = decompress(compressed);
  assert.equal(output, input);
});

test('compression ratio — repetitive text compresses well', () => {
  const input = 'abcdef '.repeat(100);
  const compressed = compress(input);
  const ratio = compressionRatio(input, compressed);
  assert.ok(ratio < 0.5, `Expected ratio < 0.5, got ${ratio}`);
});

test('empty input', () => {
  assert.equal(decode(encode('')), '');
  assert.equal(decompress(compress('')), '');
});

test('single character', () => {
  assert.equal(decode(encode('A')), 'A');
});

test('long repeating pattern', () => {
  const input = 'Hello World! '.repeat(50);
  const output = decode(encode(input));
  assert.equal(output, input);
});

test('binary compress preserves data', () => {
  const input = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet.';
  const compressed = compress(input);
  const decompressed = decompress(compressed);
  assert.equal(decompressed, input);
});
