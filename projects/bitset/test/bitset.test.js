import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BitSet } from '../src/index.js';

describe('basic', () => {
  it('set/get', () => { const b = new BitSet(32); b.set(5); assert.equal(b.get(5), true); assert.equal(b.get(6), false); });
  it('clear', () => { const b = new BitSet(32); b.set(5); b.clear(5); assert.equal(b.get(5), false); });
  it('toggle', () => { const b = new BitSet(32); b.toggle(3); assert.equal(b.get(3), true); b.toggle(3); assert.equal(b.get(3), false); });
  it('count', () => { const b = new BitSet(64); b.set(0); b.set(31); b.set(32); assert.equal(b.count, 3); });
  it('from array', () => { const b = BitSet.from([1,0,1,0,1]); assert.equal(b.count, 3); });
});

describe('set ops', () => {
  it('and', () => { const a = BitSet.from([1,1,0,0]); const b = BitSet.from([1,0,1,0]); assert.deepEqual(a.and(b).toArray(), [0]); });
  it('or', () => { const a = BitSet.from([1,0,0]); const b = BitSet.from([0,0,1]); assert.deepEqual(a.or(b).toArray(), [0, 2]); });
  it('xor', () => { const a = BitSet.from([1,1,0]); const b = BitSet.from([1,0,1]); assert.deepEqual(a.xor(b).toArray(), [1, 2]); });
  it('not', () => { const b = new BitSet(4); b.set(0); b.set(2); const n = b.not(); assert.equal(n.get(1), true); assert.equal(n.get(0), false); });
});

describe('utility', () => {
  it('isEmpty', () => { assert.equal(new BitSet(32).isEmpty(), true); });
  it('equals', () => { const a = new BitSet(32); const b = new BitSet(32); a.set(5); b.set(5); assert.equal(a.equals(b), true); });
  it('clone', () => { const a = new BitSet(32); a.set(10); const b = a.clone(); assert.equal(b.get(10), true); });
  it('toString', () => { const b = new BitSet(4); b.set(0); b.set(2); assert.equal(b.toString(), '1010'); });
  it('iterator', () => { const b = new BitSet(8); b.set(1); b.set(3); assert.deepEqual([...b], [1, 3]); });
});
