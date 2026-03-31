import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { range } from '../src/index.js';

describe('range', () => {
  it('range(5)', () => assert.deepEqual(range(5).toArray(), [0, 1, 2, 3, 4]));
  it('range(2, 5)', () => assert.deepEqual(range(2, 5).toArray(), [2, 3, 4]));
  it('range(0, 10, 2)', () => assert.deepEqual(range(0, 10, 2).toArray(), [0, 2, 4, 6, 8]));
  it('range(5, 0, -1)', () => assert.deepEqual(range(5, 0, -1).toArray(), [5, 4, 3, 2, 1]));
  it('length', () => assert.equal(range(10).length, 10));
  it('includes', () => { assert.ok(range(10).includes(5)); assert.ok(!range(10).includes(10)); });
  it('at', () => assert.equal(range(5).at(3), 3));
  it('map', () => assert.deepEqual(range(3).map(x => x * 2), [0, 2, 4]));
  it('filter', () => assert.deepEqual(range(10).filter(x => x % 2 === 0), [0, 2, 4, 6, 8]));
  it('reduce', () => assert.equal(range(1, 6).reduce((a, b) => a + b, 0), 15));
  it('spread', () => assert.deepEqual([...range(3)], [0, 1, 2]));
  it('empty range', () => assert.equal(range(0).length, 0));
  it('step zero throws', () => assert.throws(() => range(0, 10, 0), /Step/));
});
