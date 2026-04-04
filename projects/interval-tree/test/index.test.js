import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IntervalTree } from '../src/index.js';

describe('IntervalTree — basic', () => {
  it('creates empty', () => {
    const t = new IntervalTree();
    assert.equal(t.size, 0);
  });

  it('inserts intervals', () => {
    const t = new IntervalTree();
    t.insert(1, 5); t.insert(3, 7); t.insert(10, 15);
    assert.equal(t.size, 3);
  });
});

describe('IntervalTree — search overlap', () => {
  function makeTree() {
    const t = new IntervalTree();
    t.insert(1, 5, 'A');
    t.insert(3, 7, 'B');
    t.insert(10, 15, 'C');
    t.insert(12, 20, 'D');
    t.insert(25, 30, 'E');
    return t;
  }

  it('finds overlapping intervals', () => {
    const t = makeTree();
    const results = t.search(4, 6);
    assert.ok(results.some(r => r.data === 'A'));
    assert.ok(results.some(r => r.data === 'B'));
    assert.ok(!results.some(r => r.data === 'C'));
  });

  it('finds intervals at boundary', () => {
    const t = makeTree();
    const results = t.search(5, 5);
    assert.ok(results.some(r => r.data === 'A'));
    assert.ok(results.some(r => r.data === 'B'));
  });

  it('no overlap', () => {
    const t = makeTree();
    assert.equal(t.search(8, 9).length, 0);
  });

  it('all overlap', () => {
    const t = makeTree();
    const results = t.search(0, 100);
    assert.equal(results.length, 5);
  });
});

describe('IntervalTree — point query', () => {
  it('finds intervals containing point', () => {
    const t = new IntervalTree();
    t.insert(1, 10, 'X');
    t.insert(5, 15, 'Y');
    t.insert(20, 30, 'Z');
    
    const results = t.queryPoint(7);
    assert.equal(results.length, 2);
    assert.ok(results.some(r => r.data === 'X'));
    assert.ok(results.some(r => r.data === 'Y'));
  });

  it('point outside all intervals', () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    assert.equal(t.queryPoint(10).length, 0);
  });
});

describe('IntervalTree — hasOverlap', () => {
  it('returns true for overlap', () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    assert.equal(t.hasOverlap(3, 7), true);
  });

  it('returns false for no overlap', () => {
    const t = new IntervalTree();
    t.insert(1, 5);
    assert.equal(t.hasOverlap(6, 10), false);
  });
});

describe('IntervalTree — utility', () => {
  it('all() returns all intervals', () => {
    const t = new IntervalTree();
    t.insert(5, 10); t.insert(1, 3); t.insert(7, 12);
    assert.equal(t.all().length, 3);
  });

  it('min() returns smallest low', () => {
    const t = new IntervalTree();
    t.insert(5, 10); t.insert(1, 3); t.insert(7, 12);
    assert.equal(t.min().lo, 1);
  });

  it('min() on empty returns null', () => {
    assert.equal(new IntervalTree().min(), null);
  });
});

describe('IntervalTree — calendar example', () => {
  it('finds conflicting meetings', () => {
    const t = new IntervalTree();
    t.insert(9, 10, 'standup');
    t.insert(10, 11, 'design review');
    t.insert(14, 15, '1:1');
    t.insert(10.5, 11.5, 'lunch');
    
    // Does 10:30 have any meetings?
    const conflicts = t.queryPoint(10.5);
    assert.ok(conflicts.some(c => c.data === 'design review'));
    assert.ok(conflicts.some(c => c.data === 'lunch'));
  });
});
