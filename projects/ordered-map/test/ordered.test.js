import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { OrderedMap } from '../src/index.js';
describe('OrderedMap', () => {
  it('preserves order', () => { const m = new OrderedMap(); m.set('b', 2); m.set('a', 1); m.set('c', 3); assert.deepEqual([...m.keys()], ['b', 'a', 'c']); });
  it('get/set', () => { const m = new OrderedMap(); m.set('x', 42); assert.equal(m.get('x'), 42); });
  it('first/last', () => { const m = new OrderedMap(); m.set('a', 1); m.set('b', 2); assert.deepEqual(m.first(), ['a', 1]); assert.deepEqual(m.last(), ['b', 2]); });
  it('at', () => { const m = new OrderedMap(); m.set('a', 1); m.set('b', 2); assert.deepEqual(m.at(1), ['b', 2]); });
  it('delete', () => { const m = new OrderedMap(); m.set('a', 1); m.set('b', 2); m.delete('a'); assert.deepEqual([...m.keys()], ['b']); });
  it('iterator', () => { const m = new OrderedMap(); m.set('a', 1); assert.deepEqual([...m], [['a', 1]]); });
});
