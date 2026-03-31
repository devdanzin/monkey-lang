import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RingBuffer } from '../src/index.js';

describe('basic', () => {
  it('push and shift', () => { const r = new RingBuffer(3); r.push(1); r.push(2); assert.equal(r.shift(), 1); assert.equal(r.shift(), 2); });
  it('peek', () => { const r = new RingBuffer(3); r.push(1); r.push(2); assert.equal(r.peek(), 1); assert.equal(r.peekLast(), 2); });
  it('size', () => { const r = new RingBuffer(3); r.push(1); r.push(2); assert.equal(r.size, 2); assert.equal(r.capacity, 3); });
  it('empty', () => { const r = new RingBuffer(3); assert.equal(r.isEmpty, true); assert.equal(r.shift(), undefined); });
});

describe('overflow', () => {
  it('overwrites oldest', () => {
    const r = new RingBuffer(3);
    r.push(1); r.push(2); r.push(3); r.push(4);
    assert.equal(r.size, 3);
    assert.deepEqual(r.toArray(), [2, 3, 4]);
  });
  it('isFull', () => { const r = new RingBuffer(2); r.push(1); r.push(2); assert.equal(r.isFull, true); });
});

describe('utility', () => {
  it('toArray', () => { const r = new RingBuffer(5); r.push(1); r.push(2); r.push(3); assert.deepEqual(r.toArray(), [1, 2, 3]); });
  it('iterator', () => { const r = new RingBuffer(5); r.push(10); r.push(20); assert.deepEqual([...r], [10, 20]); });
  it('at', () => { const r = new RingBuffer(5); r.push(1); r.push(2); r.push(3); assert.equal(r.at(1), 2); });
  it('clear', () => { const r = new RingBuffer(3); r.push(1); r.push(2); r.clear(); assert.equal(r.size, 0); assert.equal(r.isEmpty, true); });
  it('out of bounds', () => { const r = new RingBuffer(3); assert.equal(r.at(5), undefined); });
});
