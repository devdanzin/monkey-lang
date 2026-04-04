import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnionFind, WeightedUnionFind } from '../src/index.js';

describe('UnionFind — basic', () => {
  it('creates with size', () => {
    const uf = new UnionFind(5);
    assert.equal(uf.componentCount, 5);
  });

  it('find returns self initially', () => {
    const uf = new UnionFind(3);
    assert.equal(uf.find(0), 0);
    assert.equal(uf.find(2), 2);
  });

  it('union connects elements', () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    assert.equal(uf.connected(0, 1), true);
    assert.equal(uf.connected(0, 2), false);
  });

  it('transitive connectivity', () => {
    const uf = new UnionFind(5);
    uf.union(0, 1); uf.union(1, 2);
    assert.equal(uf.connected(0, 2), true);
  });

  it('component count decreases', () => {
    const uf = new UnionFind(5);
    assert.equal(uf.componentCount, 5);
    uf.union(0, 1);
    assert.equal(uf.componentCount, 4);
    uf.union(2, 3);
    assert.equal(uf.componentCount, 3);
  });

  it('duplicate union returns false', () => {
    const uf = new UnionFind(3);
    assert.equal(uf.union(0, 1), true);
    assert.equal(uf.union(0, 1), false);
  });
});

describe('UnionFind — component size', () => {
  it('tracks size', () => {
    const uf = new UnionFind(5);
    assert.equal(uf.componentSize(0), 1);
    uf.union(0, 1);
    assert.equal(uf.componentSize(0), 2);
    uf.union(0, 2);
    assert.equal(uf.componentSize(0), 3);
  });
});

describe('UnionFind — components', () => {
  it('returns all components', () => {
    const uf = new UnionFind(6);
    uf.union(0, 1); uf.union(2, 3); uf.union(4, 5);
    const comps = uf.components();
    assert.equal(comps.length, 3);
  });
});

describe('UnionFind — makeSet', () => {
  it('dynamically adds elements', () => {
    const uf = new UnionFind(0);
    uf.makeSet(); uf.makeSet(); uf.makeSet();
    assert.equal(uf.componentCount, 3);
    uf.union(0, 2);
    assert.equal(uf.connected(0, 2), true);
  });
});

describe('UnionFind — stress', () => {
  it('handles 10000 elements', () => {
    const uf = new UnionFind(10000);
    for (let i = 0; i < 9999; i++) uf.union(i, i + 1);
    assert.equal(uf.componentCount, 1);
    assert.equal(uf.componentSize(0), 10000);
  });
});

describe('WeightedUnionFind', () => {
  it('tracks weight differences', () => {
    const wuf = new WeightedUnionFind(4);
    wuf.union(0, 1, 3);  // w(0) - w(1) = 3
    wuf.union(1, 2, 5);  // w(1) - w(2) = 5
    
    // Verify consistency
    const d01 = wuf.diff(0, 1);
    const d12 = wuf.diff(1, 2);
    const d02 = wuf.diff(0, 2);
    
    assert.equal(d01, 3);
    assert.equal(d02, d01 + d12); // transitivity
  });

  it('undefined for disconnected', () => {
    const wuf = new WeightedUnionFind(3);
    assert.equal(wuf.diff(0, 1), undefined);
  });
});
