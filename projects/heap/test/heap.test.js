import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinHeap, MaxHeap, BinaryHeap, PriorityQueue } from '../src/index.js';

describe('MinHeap', () => {
  it('returns smallest first', () => {
    const h = new MinHeap();
    h.push(5).push(3).push(7).push(1);
    assert.equal(h.pop(), 1);
    assert.equal(h.pop(), 3);
    assert.equal(h.pop(), 5);
    assert.equal(h.pop(), 7);
  });
  it('peek', () => {
    const h = new MinHeap();
    h.push(5).push(2);
    assert.equal(h.peek(), 2);
    assert.equal(h.size, 2);
  });
  it('empty', () => {
    const h = new MinHeap();
    assert.equal(h.pop(), undefined);
    assert.equal(h.peek(), undefined);
    assert.equal(h.isEmpty, true);
  });
});

describe('MaxHeap', () => {
  it('returns largest first', () => {
    const h = new MaxHeap();
    h.push(5).push(3).push(7).push(1);
    assert.equal(h.pop(), 7);
    assert.equal(h.pop(), 5);
  });
});

describe('BinaryHeap', () => {
  it('custom comparator', () => {
    const h = new BinaryHeap((a, b) => a.age - b.age);
    h.push({name:'B',age:30}).push({name:'A',age:20}).push({name:'C',age:25});
    assert.equal(h.pop().name, 'A');
  });
  it('from array (heapify)', () => {
    const h = BinaryHeap.from([5,3,7,1,9,2]);
    assert.equal(h.pop(), 1);
    assert.equal(h.pop(), 2);
    assert.equal(h.pop(), 3);
  });
  it('toSortedArray', () => {
    const h = BinaryHeap.from([5,3,1,4,2]);
    assert.deepEqual(h.toSortedArray(), [1,2,3,4,5]);
  });
  it('pushPop', () => {
    const h = BinaryHeap.from([2,4,6]);
    assert.equal(h.pushPop(3), 2);
    assert.equal(h.peek(), 3);
  });
});

describe('PriorityQueue', () => {
  it('dequeues by priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('low', 10).enqueue('high', 1).enqueue('mid', 5);
    assert.equal(pq.dequeue(), 'high');
    assert.equal(pq.dequeue(), 'mid');
    assert.equal(pq.dequeue(), 'low');
  });
  it('peek', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 5).enqueue('b', 1);
    assert.equal(pq.peek(), 'b');
    assert.equal(pq.size, 2);
  });
});

describe('Performance', () => {
  it('handles 100k elements', () => {
    const h = new MinHeap();
    for (let i = 100000; i > 0; i--) h.push(i);
    assert.equal(h.size, 100000);
    assert.equal(h.pop(), 1);
    assert.equal(h.pop(), 2);
  });
});
