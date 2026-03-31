import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Deque } from '../src/index.js';

describe('pushBack/popFront', () => {
  it('FIFO', () => { const d = new Deque(); d.pushBack(1); d.pushBack(2); assert.equal(d.popFront(), 1); assert.equal(d.popFront(), 2); });
});

describe('pushFront/popBack', () => {
  it('LIFO from front', () => { const d = new Deque(); d.pushFront(1); d.pushFront(2); assert.equal(d.popBack(), 1); assert.equal(d.popBack(), 2); });
});

describe('mixed', () => {
  it('both ends', () => {
    const d = new Deque();
    d.pushBack(1); d.pushBack(2); d.pushFront(0);
    assert.deepEqual(d.toArray(), [0, 1, 2]);
    assert.equal(d.peekFront(), 0);
    assert.equal(d.peekBack(), 2);
  });
});

describe('grow', () => {
  it('auto-grows', () => {
    const d = new Deque(2);
    for (let i = 0; i < 100; i++) d.pushBack(i);
    assert.equal(d.size, 100);
    assert.equal(d.popFront(), 0);
    assert.equal(d.popBack(), 99);
  });
});

describe('utility', () => {
  it('at', () => { const d = new Deque(); d.pushBack(10); d.pushBack(20); d.pushBack(30); assert.equal(d.at(1), 20); });
  it('empty', () => { const d = new Deque(); assert.equal(d.isEmpty, true); assert.equal(d.popFront(), undefined); });
  it('clear', () => { const d = new Deque(); d.pushBack(1); d.clear(); assert.equal(d.size, 0); });
  it('iterator', () => { const d = new Deque(); d.pushBack(1); d.pushBack(2); assert.deepEqual([...d], [1, 2]); });
});
