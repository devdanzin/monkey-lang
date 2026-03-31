import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnionFind } from '../src/index.js';

describe('UnionFind', () => {
  it('initially disconnected', () => { const uf = new UnionFind(5); assert.equal(uf.connected(0, 1), false); assert.equal(uf.count, 5); });
  it('union connects', () => { const uf = new UnionFind(5); uf.union(0, 1); assert.equal(uf.connected(0, 1), true); assert.equal(uf.count, 4); });
  it('transitive', () => { const uf = new UnionFind(5); uf.union(0, 1); uf.union(1, 2); assert.equal(uf.connected(0, 2), true); });
  it('union returns false for same set', () => { const uf = new UnionFind(3); uf.union(0, 1); assert.equal(uf.union(0, 1), false); });
  it('componentSize', () => { const uf = new UnionFind(5); uf.union(0, 1); uf.union(1, 2); assert.equal(uf.componentSize(0), 3); });
  it('components', () => { const uf = new UnionFind(4); uf.union(0, 1); uf.union(2, 3); const c = uf.components(); assert.equal(c.length, 2); });
  it('stress: 1000 elements', () => {
    const uf = new UnionFind(1000);
    for (let i = 0; i < 999; i++) uf.union(i, i + 1);
    assert.equal(uf.count, 1);
    assert.equal(uf.connected(0, 999), true);
  });
});
