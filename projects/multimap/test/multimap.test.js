import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { MultiMap } from '../src/index.js';
describe('MultiMap', () => {
  it('set/get', () => { const m = new MultiMap(); m.set('a', 1); m.set('a', 2); assert.deepEqual(m.get('a'), [1, 2]); });
  it('has', () => { const m = new MultiMap(); m.set('a', 1); assert.ok(m.has('a')); assert.ok(!m.has('b')); });
  it('delete value', () => { const m = new MultiMap(); m.set('a', 1); m.set('a', 2); m.delete('a', 1); assert.deepEqual(m.get('a'), [2]); });
  it('delete key', () => { const m = new MultiMap(); m.set('a', 1); m.delete('a'); assert.ok(!m.has('a')); });
  it('size', () => { const m = new MultiMap(); m.set('a', 1); m.set('a', 2); m.set('b', 3); assert.equal(m.size, 3); assert.equal(m.keyCount, 2); });
  it('entries', () => { const m = new MultiMap(); m.set('a', 1); m.set('a', 2); assert.deepEqual([...m.entries()], [['a', 1], ['a', 2]]); });
});
