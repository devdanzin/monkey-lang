import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BloomFilter, CountMinSketch, HyperLogLog } from '../src/index.js';

// ===== Bloom Filter =====
describe('BloomFilter — basic', () => {
  it('reports added items as present', () => {
    const bf = new BloomFilter(1024, 7);
    bf.add('hello');
    bf.add('world');
    assert.equal(bf.has('hello'), true);
    assert.equal(bf.has('world'), true);
  });

  it('reports missing items as absent (usually)', () => {
    const bf = new BloomFilter(10000, 7);
    bf.add('hello');
    // Very unlikely to be a false positive with large filter
    assert.equal(bf.has('definitely_not_added'), false);
  });

  it('never has false negatives', () => {
    const bf = new BloomFilter(1000, 5);
    const items = Array.from({ length: 100 }, (_, i) => `item_${i}`);
    for (const item of items) bf.add(item);
    for (const item of items) assert.equal(bf.has(item), true);
  });

  it('tracks count', () => {
    const bf = new BloomFilter(1024, 7);
    bf.add('a'); bf.add('b'); bf.add('c');
    assert.equal(bf.count, 3);
  });

  it('reports estimated FP rate', () => {
    const bf = new BloomFilter(1000, 5);
    for (let i = 0; i < 50; i++) bf.add(`item_${i}`);
    assert.ok(bf.falsePositiveRate >= 0);
    assert.ok(bf.falsePositiveRate <= 1);
  });

  it('optimal sizing reduces FP rate', () => {
    const bf = BloomFilter.optimal(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`item_${i}`);
    
    // Check FP rate with items not in filter
    let fps = 0;
    const tests = 10000;
    for (let i = 1000; i < 1000 + tests; i++) {
      if (bf.has(`item_${i}`)) fps++;
    }
    const fpRate = fps / tests;
    assert.ok(fpRate < 0.05, `FP rate ${fpRate} should be < 5%`);
  });

  it('handles numbers', () => {
    const bf = new BloomFilter(1024, 7);
    bf.add(42);
    assert.equal(bf.has(42), true);
    assert.equal(bf.has(43), false);
  });
});

// ===== Count-Min Sketch =====
describe('CountMinSketch — basic', () => {
  it('estimates counts accurately for small data', () => {
    const cms = new CountMinSketch(1024, 5);
    cms.add('apple', 3);
    cms.add('banana', 7);
    cms.add('cherry', 1);
    
    assert.equal(cms.estimate('apple'), 3);
    assert.equal(cms.estimate('banana'), 7);
    assert.equal(cms.estimate('cherry'), 1);
  });

  it('returns 0 for unseen items', () => {
    const cms = new CountMinSketch(1024, 5);
    assert.equal(cms.estimate('nonexistent'), 0);
  });

  it('never undercounts', () => {
    const cms = new CountMinSketch(256, 4);
    const actual = new Map();
    
    for (let i = 0; i < 500; i++) {
      const item = `item_${i % 50}`;
      cms.add(item);
      actual.set(item, (actual.get(item) || 0) + 1);
    }
    
    for (const [item, count] of actual) {
      assert.ok(cms.estimate(item) >= count, 
        `Estimate ${cms.estimate(item)} < actual ${count} for ${item}`);
    }
  });

  it('tracks total count', () => {
    const cms = new CountMinSketch(1024, 5);
    cms.add('a', 5);
    cms.add('b', 3);
    assert.equal(cms.totalCount, 8);
  });

  it('optimal sizing', () => {
    const cms = CountMinSketch.optimal(0.001, 0.01);
    assert.ok(cms.width > 0);
    assert.ok(cms.depth > 0);
  });

  it('incremental adds accumulate', () => {
    const cms = new CountMinSketch(1024, 5);
    cms.add('x'); cms.add('x'); cms.add('x');
    assert.equal(cms.estimate('x'), 3);
  });
});

// ===== HyperLogLog =====
describe('HyperLogLog — basic', () => {
  it('estimates small cardinality', () => {
    const hll = new HyperLogLog(10);
    for (let i = 0; i < 100; i++) hll.add(`item_${i}`);
    const est = hll.estimate();
    // Should be roughly 100, within 20%
    assert.ok(est > 70, `Estimate ${est} too low (expected ~100)`);
    assert.ok(est < 150, `Estimate ${est} too high (expected ~100)`);
  });

  it('estimates medium cardinality', () => {
    const hll = new HyperLogLog(14);
    for (let i = 0; i < 10000; i++) hll.add(`item_${i}`);
    const est = hll.estimate();
    assert.ok(est > 8000, `Estimate ${est} too low (expected ~10000)`);
    assert.ok(est < 12000, `Estimate ${est} too high (expected ~10000)`);
  });

  it('handles duplicates correctly', () => {
    const hll = new HyperLogLog(12);
    for (let i = 0; i < 1000; i++) {
      hll.add('same_item'); // all same
    }
    const est = hll.estimate();
    assert.ok(est <= 3, `Estimate ${est} should be ~1 for all-same items`);
  });

  it('merge combines two HLLs', () => {
    const hll1 = new HyperLogLog(10);
    const hll2 = new HyperLogLog(10);
    
    for (let i = 0; i < 100; i++) hll1.add(`a_${i}`);
    for (let i = 0; i < 100; i++) hll2.add(`b_${i}`);
    
    hll1.merge(hll2);
    const est = hll1.estimate();
    // Should be roughly 200
    assert.ok(est > 150, `Merged estimate ${est} too low (expected ~200)`);
    assert.ok(est < 300, `Merged estimate ${est} too high (expected ~200)`);
  });

  it('merge with overlap', () => {
    const hll1 = new HyperLogLog(12);
    const hll2 = new HyperLogLog(12);
    
    // 50 unique to each, 50 shared
    for (let i = 0; i < 100; i++) hll1.add(`item_${i}`);
    for (let i = 50; i < 150; i++) hll2.add(`item_${i}`);
    
    hll1.merge(hll2);
    const est = hll1.estimate();
    // Should be roughly 150 (union of 0-149)
    assert.ok(est > 110, `Merged estimate ${est} too low (expected ~150)`);
    assert.ok(est < 200, `Merged estimate ${est} too high (expected ~150)`);
  });

  it('handles numbers and strings', () => {
    const hll = new HyperLogLog(10);
    hll.add(42);
    hll.add('hello');
    hll.add(42); // duplicate
    const est = hll.estimate();
    assert.ok(est >= 1 && est <= 5);
  });
});
