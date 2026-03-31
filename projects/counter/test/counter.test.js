import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { Counter } from '../src/index.js';
describe('Counter', () => {
  it('counts', () => { const c = Counter.from('banana'); assert.equal(c.get('a'), 3); assert.equal(c.get('b'), 1); });
  it('increment', () => { const c = new Counter(); c.increment('a'); c.increment('a'); assert.equal(c.get('a'), 2); });
  it('decrement', () => { const c = Counter.from('aaa'); c.decrement('a'); assert.equal(c.get('a'), 2); });
  it('total', () => assert.equal(Counter.from('hello').total, 5));
  it('mostCommon', () => { const c = Counter.from('aabbc'); assert.equal(c.mostCommon(1)[0][0], 'a'); });
  it('leastCommon', () => { const c = Counter.from('aabbc'); assert.equal(c.leastCommon(1)[0][0], 'c'); });
  it('merge', () => { const a = Counter.from('aa'), b = Counter.from('ab'); a.merge(b); assert.equal(a.get('a'), 3); });
  it('toObject', () => assert.deepEqual(Counter.from('ab').toObject(), { a: 1, b: 1 }));
});
