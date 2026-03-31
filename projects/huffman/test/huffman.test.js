import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, buildCodeTable, encode, decode, compressionRatio } from '../src/index.js';

describe('buildTree', () => {
  it('builds tree', () => { const t = buildTree('aabbc'); assert.ok(t); assert.equal(t.freq, 5); });
  it('single char', () => { const t = buildTree('aaa'); assert.ok(t.isLeaf); assert.equal(t.char, 'a'); });
});

describe('encode/decode', () => {
  it('roundtrip simple', () => {
    const { encoded, tree } = encode('hello world');
    const decoded = decode(encoded, tree);
    assert.equal(decoded, 'hello world');
  });
  it('roundtrip repeated', () => {
    const { encoded, tree } = encode('aaabbbccc');
    assert.equal(decode(encoded, tree), 'aaabbbccc');
  });
  it('single char roundtrip', () => {
    const { encoded, tree } = encode('aaaa');
    assert.equal(decode(encoded, tree), 'aaaa');
  });
  it('empty', () => {
    const { encoded } = encode('');
    assert.equal(encoded, '');
  });
  it('long text', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const { encoded, tree } = encode(text);
    assert.equal(decode(encoded, tree), text);
  });
});

describe('codes', () => {
  it('prefix-free', () => {
    const { codes } = encode('abcdef');
    const codeList = Object.values(codes);
    for (let i = 0; i < codeList.length; i++) {
      for (let j = 0; j < codeList.length; j++) {
        if (i !== j) assert.ok(!codeList[j].startsWith(codeList[i]), `${codeList[i]} is prefix of ${codeList[j]}`);
      }
    }
  });
  it('shorter codes for frequent chars', () => {
    const { codes } = encode('aaaaabc');
    assert.ok(codes['a'].length <= codes['b'].length);
  });
});

describe('compression', () => {
  it('compresses repetitive text', () => {
    const ratio = compressionRatio('aaaaaaaabbbbccdd');
    assert.ok(ratio > 0);
  });
});
