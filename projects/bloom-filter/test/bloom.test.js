import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BloomFilter } from '../src/index.js';

describe('Basic add/has', () => {
  it('reports added items', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('hello').add('world');
    assert.equal(bf.has('hello'), true);
    assert.equal(bf.has('world'), true);
  });
  it('probably rejects non-added items', () => {
    const bf = new BloomFilter(10000, 5);
    for (let i = 0; i < 100; i++) bf.add(`item${i}`);
    // False positives are possible but should be rare with large filter
    let falsePositives = 0;
    for (let i = 100; i < 200; i++) { if (bf.has(`item${i}`)) falsePositives++; }
    assert.ok(falsePositives < 10, `Too many false positives: ${falsePositives}`);
  });
  it('count tracks additions', () => {
    const bf = new BloomFilter();
    bf.add('a').add('b').add('c');
    assert.equal(bf.count, 3);
  });
});

describe('Optimal creation', () => {
  it('creates filter with target FP rate', () => {
    const bf = BloomFilter.optimal(1000, 0.01);
    assert.ok(bf.size > 0);
    assert.ok(bf.hashCount > 0);
    // For 1000 items at 1% FP: ~9585 bits, ~7 hashes
    assert.ok(bf.size > 5000);
    assert.ok(bf.hashCount >= 5);
  });
});

describe('Merge', () => {
  it('union of two filters', () => {
    const a = new BloomFilter(1024, 3);
    const b = new BloomFilter(1024, 3);
    a.add('hello');
    b.add('world');
    const merged = a.merge(b);
    assert.equal(merged.has('hello'), true);
    assert.equal(merged.has('world'), true);
  });
  it('throws for incompatible', () => {
    const a = new BloomFilter(1024, 3);
    const b = new BloomFilter(512, 3);
    assert.throws(() => a.merge(b));
  });
});

describe('Clear', () => {
  it('resets filter', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add('hello');
    bf.clear();
    assert.equal(bf.has('hello'), false);
    assert.equal(bf.count, 0);
  });
});

describe('False positive rate', () => {
  it('estimates FP rate', () => {
    const bf = new BloomFilter(1000, 3);
    for (let i = 0; i < 50; i++) bf.add(i);
    assert.ok(bf.falsePositiveRate >= 0);
    assert.ok(bf.falsePositiveRate <= 1);
  });
});

describe('Various data types', () => {
  it('works with numbers', () => {
    const bf = new BloomFilter(1024, 3);
    bf.add(42).add(100);
    assert.equal(bf.has(42), true);
    assert.equal(bf.has(100), true);
  });
});
