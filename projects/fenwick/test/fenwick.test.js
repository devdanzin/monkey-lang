import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FenwickTree, FenwickTree2D } from '../src/index.js';

describe('FenwickTree', () => {
  it('from array', () => { const ft = FenwickTree.from([1, 2, 3, 4, 5]); assert.equal(ft.prefixSum(4), 15); });
  it('prefix sum', () => { const ft = FenwickTree.from([1, 2, 3]); assert.equal(ft.prefixSum(1), 3); });
  it('range sum', () => { const ft = FenwickTree.from([1, 2, 3, 4]); assert.equal(ft.rangeSum(1, 3), 9); });
  it('update', () => { const ft = FenwickTree.from([1, 2, 3]); ft.update(1, 5); assert.equal(ft.get(1), 7); });
  it('set', () => { const ft = FenwickTree.from([1, 2, 3]); ft.set(1, 10); assert.equal(ft.get(1), 10); });
  it('size', () => assert.equal(FenwickTree.from([1, 2]).size, 2));
  it('stress: 1000 elements', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i + 1);
    const ft = FenwickTree.from(arr);
    assert.equal(ft.prefixSum(999), 500500);
  });
});

describe('FenwickTree2D', () => {
  it('2D prefix sum', () => {
    const ft = new FenwickTree2D(3, 3);
    ft.update(0, 0, 1); ft.update(0, 1, 2); ft.update(1, 0, 3); ft.update(1, 1, 4);
    assert.equal(ft.prefixSum(1, 1), 10);
  });
});
