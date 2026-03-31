import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { chunk, zip, unzip, unique, groupBy, compact, flatten, partition, interleave, windows } from '../src/index.js';
describe('array utils', () => {
  it('chunk', () => assert.deepEqual(chunk([1,2,3,4,5], 2), [[1,2],[3,4],[5]]));
  it('zip', () => assert.deepEqual(zip([1,2], ['a','b']), [[1,'a'],[2,'b']]));
  it('unzip', () => assert.deepEqual(unzip([[1,'a'],[2,'b']]), [[1,2],['a','b']]));
  it('unique', () => assert.deepEqual(unique([1,2,2,3,3]), [1,2,3]));
  it('groupBy', () => { const g = groupBy([{a:1},{a:2},{a:1}], 'a'); assert.equal(g[1].length, 2); });
  it('compact', () => assert.deepEqual(compact([0, 1, false, 2, '', 3]), [1, 2, 3]));
  it('flatten', () => assert.deepEqual(flatten([1,[2,[3]]]), [1,2,3]));
  it('flatten depth', () => assert.deepEqual(flatten([1,[2,[3]]], 1), [1,2,[3]]));
  it('partition', () => assert.deepEqual(partition([1,2,3,4], x => x % 2 === 0), [[2,4],[1,3]]));
  it('interleave', () => assert.deepEqual(interleave([1,2], ['a','b']), [1,'a',2,'b']));
  it('windows', () => assert.deepEqual(windows([1,2,3,4], 3), [[1,2,3],[2,3,4]]));
});
