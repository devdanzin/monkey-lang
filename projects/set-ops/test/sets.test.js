import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { union, intersection, difference, symmetricDifference, isSubset, isSuperset, isDisjoint, equals, powerSet } from '../src/index.js';
const a = new Set([1,2,3]), b = new Set([2,3,4]);
describe('ops', () => {
  it('union', () => assert.deepEqual([...union(a,b)].sort(), [1,2,3,4]));
  it('intersection', () => assert.deepEqual([...intersection(a,b)].sort(), [2,3]));
  it('difference', () => assert.deepEqual([...difference(a,b)], [1]));
  it('symDiff', () => assert.deepEqual([...symmetricDifference(a,b)].sort(), [1,4]));
  it('isSubset', () => assert.ok(isSubset(new Set([1,2]), a)));
  it('isSuperset', () => assert.ok(isSuperset(a, new Set([1,2]))));
  it('isDisjoint', () => assert.ok(isDisjoint(new Set([1]), new Set([2]))));
  it('equals', () => assert.ok(equals(new Set([1,2]), new Set([2,1]))));
  it('powerSet', () => assert.equal(powerSet(new Set([1,2])).length, 4));
});
