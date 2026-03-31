import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IntervalTree } from '../src/index.js';

describe('IntervalTree', () => {
  it('insert and search', () => {
    const tree = new IntervalTree();
    tree.insert(15, 20, 'a');
    tree.insert(10, 30, 'b');
    tree.insert(5, 20, 'c');
    tree.insert(12, 15, 'd');
    tree.insert(30, 40, 'e');
    const r = tree.search(14, 16);
    assert.ok(r.length >= 3);
  });

  it('no overlap', () => {
    const tree = new IntervalTree();
    tree.insert(1, 5, 'a');
    tree.insert(10, 15, 'b');
    assert.equal(tree.search(6, 9).length, 0);
  });

  it('contains point', () => {
    const tree = new IntervalTree();
    tree.insert(1, 10, 'a');
    tree.insert(5, 15, 'b');
    const r = tree.contains(7);
    assert.equal(r.length, 2);
  });

  it('size', () => {
    const tree = new IntervalTree();
    tree.insert(1, 2, 'a');
    tree.insert(3, 4, 'b');
    assert.equal(tree.size, 2);
  });

  it('toArray', () => {
    const tree = new IntervalTree();
    tree.insert(5, 10, 'b');
    tree.insert(1, 3, 'a');
    const arr = tree.toArray();
    assert.equal(arr.length, 2);
  });

  it('exact boundary', () => {
    const tree = new IntervalTree();
    tree.insert(1, 5, 'a');
    assert.equal(tree.search(5, 5).length, 1);
    assert.equal(tree.search(6, 10).length, 0);
  });
});
