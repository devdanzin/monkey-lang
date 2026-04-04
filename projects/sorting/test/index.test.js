import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quicksort, mergesort, heapsort, timsort, introsort, benchmark } from '../src/index.js';

function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i-1]) return false;
  }
  return true;
}

const randomArray = (n) => Array.from({ length: n }, () => Math.random() * 1000 | 0);

const algorithms = [
  ['quicksort', quicksort],
  ['mergesort', mergesort],
  ['heapsort', heapsort],
  ['timsort', timsort],
  ['introsort', introsort],
];

for (const [name, fn] of algorithms) {
  describe(`${name}`, () => {
    it('sorts empty array', () => {
      assert.deepEqual(fn([]).sorted, []);
    });

    it('sorts single element', () => {
      assert.deepEqual(fn([42]).sorted, [42]);
    });

    it('sorts sorted array', () => {
      assert.deepEqual(fn([1, 2, 3, 4, 5]).sorted, [1, 2, 3, 4, 5]);
    });

    it('sorts reverse array', () => {
      assert.deepEqual(fn([5, 4, 3, 2, 1]).sorted, [1, 2, 3, 4, 5]);
    });

    it('sorts array with duplicates', () => {
      assert.deepEqual(fn([3, 1, 4, 1, 5, 9, 2, 6]).sorted, [1, 1, 2, 3, 4, 5, 6, 9]);
    });

    it('sorts random array (100)', () => {
      const { sorted } = fn(randomArray(100));
      assert.ok(isSorted(sorted));
    });

    it('sorts random array (1000)', () => {
      const { sorted } = fn(randomArray(1000));
      assert.ok(isSorted(sorted));
    });

    it('counts comparisons', () => {
      const { stats } = fn(randomArray(100));
      assert.ok(stats.comparisons > 0);
    });

    it('does not modify original', () => {
      const arr = [3, 1, 2];
      fn(arr);
      assert.deepEqual(arr, [3, 1, 2]);
    });
  });
}

describe('benchmark', () => {
  it('runs all algorithms', () => {
    const results = benchmark(100);
    assert.ok('quicksort' in results);
    assert.ok('mergesort' in results);
    assert.ok('heapsort' in results);
    assert.ok('timsort' in results);
    assert.ok('introsort' in results);
  });
});
