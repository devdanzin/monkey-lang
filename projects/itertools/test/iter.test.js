import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../src/index.js';

describe('Creation', () => {
  it('range', () => { assert.deepEqual(I.toArray(I.range(5)), [0,1,2,3,4]); });
  it('range with start/end', () => { assert.deepEqual(I.toArray(I.range(2, 5)), [2,3,4]); });
  it('range with step', () => { assert.deepEqual(I.toArray(I.range(0, 10, 3)), [0,3,6,9]); });
  it('repeat', () => { assert.deepEqual(I.toArray(I.take(I.repeat('x'), 3)), ['x','x','x']); });
  it('cycle', () => { assert.deepEqual(I.toArray(I.take(I.cycle([1,2]), 5)), [1,2,1,2,1]); });
  it('generate', () => { assert.deepEqual(I.toArray(I.take(I.generate(i => i*i), 4)), [0,1,4,9]); });
});

describe('Transform', () => {
  it('map', () => { assert.deepEqual(I.toArray(I.map([1,2,3], x => x*2)), [2,4,6]); });
  it('filter', () => { assert.deepEqual(I.toArray(I.filter([1,2,3,4], x => x%2===0)), [2,4]); });
  it('flatMap', () => { assert.deepEqual(I.toArray(I.flatMap([1,2], x => [x, x*10])), [1,10,2,20]); });
  it('scan', () => { assert.deepEqual(I.toArray(I.scan([1,2,3], (a,b) => a+b, 0)), [1,3,6]); });
  it('enumerate', () => { assert.deepEqual(I.toArray(I.enumerate(['a','b'])), [[0,'a'],[1,'b']]); });
});

describe('Combination', () => {
  it('zip', () => { assert.deepEqual(I.toArray(I.zip([1,2],[3,4])), [[1,3],[2,4]]); });
  it('chain', () => { assert.deepEqual(I.toArray(I.chain([1,2],[3,4])), [1,2,3,4]); });
});

describe('Slicing', () => {
  it('take', () => { assert.deepEqual(I.toArray(I.take([1,2,3,4,5], 3)), [1,2,3]); });
  it('skip', () => { assert.deepEqual(I.toArray(I.skip([1,2,3,4,5], 2)), [3,4,5]); });
  it('takeWhile', () => { assert.deepEqual(I.toArray(I.takeWhile([1,2,3,4,1], x => x<3)), [1,2]); });
  it('skipWhile', () => { assert.deepEqual(I.toArray(I.skipWhile([1,2,3,4], x => x<3)), [3,4]); });
  it('slice', () => { assert.deepEqual(I.toArray(I.slice([0,1,2,3,4], 1, 4)), [1,2,3]); });
});

describe('Grouping', () => {
  it('chunk', () => { assert.deepEqual(I.toArray(I.chunk([1,2,3,4,5], 2)), [[1,2],[3,4],[5]]); });
  it('window', () => { assert.deepEqual(I.toArray(I.window([1,2,3,4], 3)), [[1,2,3],[2,3,4]]); });
  it('unique', () => { assert.deepEqual(I.toArray(I.unique([1,2,2,3,1])), [1,2,3]); });
});

describe('Reduction', () => {
  it('reduce', () => { assert.equal(I.reduce([1,2,3], (a,b) => a+b, 0), 6); });
  it('count', () => { assert.equal(I.count(I.range(10)), 10); });
  it('some', () => { assert.equal(I.some([1,2,3], x => x>2), true); assert.equal(I.some([1,2], x => x>2), false); });
  it('every', () => { assert.equal(I.every([2,4,6], x => x%2===0), true); });
  it('find', () => { assert.equal(I.find([1,2,3], x => x>1), 2); });
  it('first', () => { assert.equal(I.first([10,20]), 10); });
  it('last', () => { assert.equal(I.last([10,20,30]), 30); });
  it('sum', () => { assert.equal(I.sum([1,2,3,4]), 10); });
  it('min/max', () => { assert.equal(I.min([3,1,4,1,5]), 1); assert.equal(I.max([3,1,4,1,5]), 5); });
});

describe('Laziness', () => {
  it('map + filter + take is lazy', () => {
    let evaluated = 0;
    const result = I.toArray(I.take(I.filter(I.map(I.range(1000000), x => { evaluated++; return x * 2; }), x => x % 4 === 0), 3));
    assert.deepEqual(result, [0, 4, 8]);
    assert.ok(evaluated < 10); // Only evaluated a few, not all million
  });
});

describe('pipe', () => {
  it('composes operations', () => {
    const result = I.toArray(I.pipe(
      I.range(10),
      it => I.filter(it, x => x % 2 === 0),
      it => I.map(it, x => x * 10),
      it => I.take(it, 3)
    ));
    assert.deepEqual(result, [0, 20, 40]);
  });
});
