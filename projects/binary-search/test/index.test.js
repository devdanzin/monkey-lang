import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { binarySearch, lowerBound, upperBound, searchInsert, count, firstOccurrence, lastOccurrence, searchRotated, findMinRotated, findPeak, bisect } from '../src/index.js';

describe('binarySearch', () => {
  it('finds element', () => assert.equal(binarySearch([1,3,5,7,9], 5), 2));
  it('returns -1 for missing', () => assert.equal(binarySearch([1,3,5], 4), -1));
  it('first element', () => assert.equal(binarySearch([1,2,3], 1), 0));
  it('last element', () => assert.equal(binarySearch([1,2,3], 3), 2));
  it('empty array', () => assert.equal(binarySearch([], 1), -1));
});

describe('lowerBound / upperBound', () => {
  it('lowerBound finds first >=', () => assert.equal(lowerBound([1,2,2,3], 2), 1));
  it('upperBound finds first >', () => assert.equal(upperBound([1,2,2,3], 2), 3));
  it('lowerBound for missing', () => assert.equal(lowerBound([1,3,5], 4), 2));
  it('upperBound for missing', () => assert.equal(upperBound([1,3,5], 4), 2));
});

describe('searchInsert', () => {
  it('existing element', () => assert.equal(searchInsert([1,3,5,6], 5), 2));
  it('insert position', () => assert.equal(searchInsert([1,3,5,6], 2), 1));
  it('before all', () => assert.equal(searchInsert([1,3,5], 0), 0));
  it('after all', () => assert.equal(searchInsert([1,3,5], 7), 3));
});

describe('count / first / last', () => {
  it('counts occurrences', () => assert.equal(count([1,2,2,2,3], 2), 3));
  it('count zero', () => assert.equal(count([1,3,5], 2), 0));
  it('firstOccurrence', () => assert.equal(firstOccurrence([1,2,2,3], 2), 1));
  it('lastOccurrence', () => assert.equal(lastOccurrence([1,2,2,3], 2), 2));
  it('first of missing', () => assert.equal(firstOccurrence([1,3,5], 2), -1));
});

describe('searchRotated', () => {
  it('finds in rotated', () => assert.equal(searchRotated([4,5,6,7,0,1,2], 0), 4));
  it('finds in first half', () => assert.equal(searchRotated([4,5,6,7,0,1,2], 5), 1));
  it('missing', () => assert.equal(searchRotated([4,5,6,7,0,1,2], 3), -1));
  it('no rotation', () => assert.equal(searchRotated([1,2,3,4,5], 3), 2));
});

describe('findMinRotated', () => {
  it('finds min in rotated', () => assert.equal(findMinRotated([4,5,6,1,2,3]), 1));
  it('no rotation', () => assert.equal(findMinRotated([1,2,3,4]), 1));
  it('single element', () => assert.equal(findMinRotated([42]), 42));
});

describe('findPeak', () => {
  it('finds a peak', () => {
    const arr = [1, 3, 5, 4, 2];
    const peak = findPeak(arr);
    assert.ok(arr[peak] >= (arr[peak-1] ?? -Infinity));
    assert.ok(arr[peak] >= (arr[peak+1] ?? -Infinity));
  });
});

describe('bisect', () => {
  it('finds sqrt', () => {
    const result = bisect(0, 100, (x) => x * x >= 49);
    assert.equal(result, 7);
  });
});
