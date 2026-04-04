import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BloomFilter, CountMinSketch, HyperLogLog } from './probabilistic.js';

describe('Bloom Filter', () => {
  it('no false negatives', () => {
    const bf = new BloomFilter(100, 0.01);
    for (let i = 0; i < 100; i++) bf.add(`item${i}`);
    for (let i = 0; i < 100; i++) assert.ok(bf.has(`item${i}`), `False negative for item${i}`);
  });

  it('likely false positives are rare', () => {
    const bf = new BloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`item${i}`);
    let fps = 0;
    for (let i = 1000; i < 2000; i++) if (bf.has(`item${i}`)) fps++;
    assert.ok(fps < 50, `Too many false positives: ${fps}/1000`); // ~1% expected
  });

  it('returns false for empty filter', () => {
    const bf = new BloomFilter();
    assert.ok(!bf.has('anything'));
  });

  it('tracks count', () => {
    const bf = new BloomFilter();
    bf.add('a'); bf.add('b'); bf.add('c');
    assert.equal(bf.size, 3);
  });

  it('optimal parameters', () => {
    const bf = new BloomFilter(10000, 0.001);
    assert.ok(bf.bitCount > 10000); // should be ~143,776 bits
    assert.ok(bf.hashCount > 5);    // should be ~10
  });

  it('merge two filters', () => {
    const a = new BloomFilter(100, 0.01);
    const b = new BloomFilter(100, 0.01);
    a.add('x'); b.add('y');
    const merged = BloomFilter.merge(a, b);
    assert.ok(merged.has('x'));
    assert.ok(merged.has('y'));
  });
});

describe('Count-Min Sketch', () => {
  it('exact count for single item', () => {
    const cms = new CountMinSketch();
    cms.add('hello', 5);
    assert.equal(cms.estimate('hello'), 5);
  });

  it('multiple items', () => {
    const cms = new CountMinSketch();
    cms.add('a', 10);
    cms.add('b', 20);
    cms.add('c', 30);
    assert.equal(cms.estimate('a'), 10);
    assert.equal(cms.estimate('b'), 20);
    assert.equal(cms.estimate('c'), 30);
  });

  it('overestimates are bounded', () => {
    const cms = new CountMinSketch(100, 5);
    for (let i = 0; i < 1000; i++) cms.add(`item${i}`, 1);
    // Estimate for any item should be >= 1 (actual)
    assert.ok(cms.estimate('item42') >= 1);
    // Overestimate should be bounded
    assert.ok(cms.estimate('item42') < 50);
  });

  it('zero for unseen items', () => {
    const cms = new CountMinSketch();
    assert.equal(cms.estimate('never-added'), 0);
  });

  it('total count', () => {
    const cms = new CountMinSketch();
    cms.add('a', 5);
    cms.add('b', 10);
    assert.equal(cms.size, 15);
  });

  it('merge two sketches', () => {
    const a = new CountMinSketch();
    const b = new CountMinSketch();
    a.add('x', 5);
    b.add('x', 3);
    const merged = CountMinSketch.merge(a, b);
    assert.equal(merged.estimate('x'), 8);
  });
});

describe('HyperLogLog', () => {
  it('estimates small cardinality', () => {
    const hll = new HyperLogLog(14);
    for (let i = 0; i < 100; i++) hll.add(`item${i}`);
    const est = hll.estimate();
    assert.ok(est > 80 && est < 120, `Estimate ${est} too far from 100`);
  });

  it('estimates medium cardinality', () => {
    const hll = new HyperLogLog(14);
    for (let i = 0; i < 10000; i++) hll.add(`item${i}`);
    const est = hll.estimate();
    assert.ok(est > 9000 && est < 11000, `Estimate ${est} too far from 10000`);
  });

  it('handles duplicates', () => {
    const hll = new HyperLogLog(14);
    for (let i = 0; i < 100; i++) hll.add('same-item');
    const est = hll.estimate();
    assert.ok(est < 5, `Estimate ${est} should be ~1`);
  });

  it('empty set', () => {
    const hll = new HyperLogLog(14);
    assert.equal(hll.estimate(), 0);
  });

  it('merge two HLLs', () => {
    const a = new HyperLogLog(14);
    const b = new HyperLogLog(14);
    for (let i = 0; i < 5000; i++) a.add(`a${i}`);
    for (let i = 0; i < 5000; i++) b.add(`b${i}`);
    const merged = HyperLogLog.merge(a, b);
    const est = merged.estimate();
    assert.ok(est > 8000 && est < 12000, `Merged estimate ${est} too far from 10000`);
  });

  it('merge with overlap', () => {
    const a = new HyperLogLog(14);
    const b = new HyperLogLog(14);
    for (let i = 0; i < 5000; i++) { a.add(`item${i}`); b.add(`item${i}`); }
    const merged = HyperLogLog.merge(a, b);
    const est = merged.estimate();
    assert.ok(est > 4000 && est < 6000, `Merged overlap estimate ${est} should be ~5000`);
  });
});
