import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bubbleSort, selectionSort, insertionSort, mergeSort,
  quickSort, quickSortHoare, heapSort, countingSort,
  radixSort, shellSort, bucketSort, benchmark,
} from './sort.js';

const sortFns = [
  ['bubbleSort', bubbleSort],
  ['selectionSort', selectionSort],
  ['insertionSort', insertionSort],
  ['mergeSort', mergeSort],
  ['quickSort', quickSort],
  ['quickSortHoare', quickSortHoare],
  ['heapSort', heapSort],
  ['countingSort', countingSort],
  ['radixSort', radixSort],
  ['shellSort', shellSort],
  ['bucketSort', bucketSort],
];

for (const [name, fn] of sortFns) {
  describe(name, () => {
    it('sorts random array', () => {
      const input = [5, 3, 8, 1, 9, 2, 7, 4, 6];
      assert.deepStrictEqual(fn(input), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    it('already sorted', () => {
      assert.deepStrictEqual(fn([1, 2, 3]), [1, 2, 3]);
    });
    it('reverse sorted', () => {
      assert.deepStrictEqual(fn([3, 2, 1]), [1, 2, 3]);
    });
    it('single element', () => {
      assert.deepStrictEqual(fn([42]), [42]);
    });
    it('empty', () => {
      assert.deepStrictEqual(fn([]), []);
    });
    it('duplicates', () => {
      assert.deepStrictEqual(fn([3, 1, 3, 1, 2]), [1, 1, 2, 3, 3]);
    });
    it('does not mutate input', () => {
      const input = [3, 1, 2];
      fn(input);
      assert.deepStrictEqual(input, [3, 1, 2]);
    });
    it('large array', () => {
      const input = Array.from({ length: 1000 }, () => Math.random() * 1000 | 0);
      const sorted = fn(input);
      for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] >= sorted[i - 1]);
    });
  });
}

describe('Benchmark', () => {
  it('runs without error', () => {
    const results = benchmark(mergeSort, [100, 500]);
    assert.ok(results[100] >= 0);
    assert.ok(results[500] >= 0);
  });
});
