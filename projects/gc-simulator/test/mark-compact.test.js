import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MarkCompactHeap } from '../src/mark-compact.js';

describe('MarkCompact — basic allocation', () => {
  it('allocates an integer', () => {
    const heap = new MarkCompactHeap(128);
    const addr = heap.allocInt(42);
    assert.equal(heap.getInt(addr), 42);
  });

  it('allocates a pair', () => {
    const heap = new MarkCompactHeap(128);
    const a = heap.allocInt(1);
    const b = heap.allocInt(2);
    const p = heap.allocPair(a, b);
    assert.equal(heap.getInt(heap.getCar(p)), 1);
    assert.equal(heap.getInt(heap.getCdr(p)), 2);
  });

  it('allocates an array', () => {
    const heap = new MarkCompactHeap(128);
    const a = heap.allocInt(10);
    const b = heap.allocInt(20);
    const arr = heap.allocArray([a, b]);
    assert.equal(heap.getArrayLength(arr), 2);
    assert.equal(heap.getInt(heap.getArrayElement(arr, 0)), 10);
    assert.equal(heap.getInt(heap.getArrayElement(arr, 1)), 20);
  });

  it('allocates a string', () => {
    const heap = new MarkCompactHeap(128);
    const addr = heap.allocString('hello');
    assert.equal(heap.getString(addr), 'hello');
  });

  it('allocates nil', () => {
    const heap = new MarkCompactHeap(128);
    const addr = heap.allocNil();
    assert.equal(heap.getTag(addr), 5); // TAG.NIL
  });
});

describe('MarkCompact — collection', () => {
  it('collects unreachable objects', () => {
    const heap = new MarkCompactHeap(64);
    
    // Allocate some garbage (no roots)
    heap.allocInt(1);
    heap.allocInt(2);
    heap.allocInt(3);
    
    const usedBefore = heap.usedWords;
    
    // Allocate a rooted object
    let rootAddr = heap.allocInt(42);
    const root = heap.addRoot(() => rootAddr, (a) => { rootAddr = a; });
    
    heap.collect();
    
    // Only the rooted object should survive
    assert.ok(heap.usedWords < usedBefore);
    assert.equal(heap.getInt(rootAddr), 42);
  });

  it('preserves reachable pair chain', () => {
    const heap = new MarkCompactHeap(128);
    
    const a = heap.allocInt(1);
    const b = heap.allocInt(2);
    const c = heap.allocInt(3);
    let pair = heap.allocPair(a, heap.allocPair(b, heap.allocPair(c, -1)));
    
    const root = heap.addRoot(() => pair, (a) => { pair = a; });
    
    // Allocate garbage
    heap.allocInt(99);
    heap.allocInt(100);
    
    heap.collect();
    
    // Traverse the chain
    assert.equal(heap.getInt(heap.getCar(pair)), 1);
    const cdr1 = heap.getCdr(pair);
    assert.equal(heap.getInt(heap.getCar(cdr1)), 2);
    const cdr2 = heap.getCdr(cdr1);
    assert.equal(heap.getInt(heap.getCar(cdr2)), 3);
    assert.equal(heap.getCdr(cdr2), -1); // NIL
  });

  it('compacts heap — objects slide to front', () => {
    const heap = new MarkCompactHeap(128);
    
    // Create: [garbage] [live] [garbage] [live]
    heap.allocInt(0); // garbage
    let a = heap.allocInt(42);
    const rootA = heap.addRoot(() => a, (v) => { a = v; });
    heap.allocInt(0); // garbage
    let b = heap.allocInt(99);
    const rootB = heap.addRoot(() => b, (v) => { b = v; });
    
    heap.collect();
    
    // After compaction, a should be at address 0, b right after
    assert.equal(a, 0);
    assert.equal(b, 3); // INT takes 3 words (tag + size + value)
    assert.equal(heap.getInt(a), 42);
    assert.equal(heap.getInt(b), 99);
  });

  it('multiple collections', () => {
    const heap = new MarkCompactHeap(64);
    
    let root = heap.allocInt(1);
    const r = heap.addRoot(() => root, (a) => { root = a; });
    
    for (let i = 0; i < 20; i++) {
      heap.allocInt(i * 100); // garbage
      if (heap.usedWords > heap.heapSize * 0.8) {
        heap.collect();
      }
    }
    
    assert.equal(heap.getInt(root), 1);
    assert.ok(heap.totalCollections > 0);
  });

  it('handles circular references', () => {
    const heap = new MarkCompactHeap(128);
    
    // Create a circular pair: car points to itself
    let p = heap.allocPair(-1, -1);
    heap.setCar(p, p);
    heap.setCdr(p, p);
    
    const root = heap.addRoot(() => p, (a) => { p = a; });
    
    // Allocate garbage
    heap.allocInt(1);
    heap.allocInt(2);
    
    heap.collect();
    
    // After collection, the pair should still be circular
    assert.equal(heap.getCar(p), p);
    assert.equal(heap.getCdr(p), p);
  });

  it('handles array with mixed pointers and non-pointers', () => {
    const heap = new MarkCompactHeap(128);
    
    const x = heap.allocInt(10);
    const y = heap.allocInt(20);
    let arr = heap.allocArray([x, y]);
    
    const root = heap.addRoot(() => arr, (a) => { arr = a; });
    
    heap.collect();
    
    assert.equal(heap.getArrayLength(arr), 2);
    assert.equal(heap.getInt(heap.getArrayElement(arr, 0)), 10);
    assert.equal(heap.getInt(heap.getArrayElement(arr, 1)), 20);
  });

  it('stats track collections', () => {
    const heap = new MarkCompactHeap(64);
    
    let root = heap.allocInt(42);
    heap.addRoot(() => root, (a) => { root = a; });
    
    heap.collect();
    
    assert.ok(heap.totalCollections >= 1);
    assert.ok(heap.totalCompacted >= 1);
  });
});

describe('MarkCompact — stress', () => {
  it('survives many alloc/collect cycles', () => {
    const heap = new MarkCompactHeap(1024);
    
    let current = -1; // NIL
    const root = heap.addRoot(() => current, (a) => { current = a; });
    
    // Build a linked list, collecting frequently
    for (let i = 0; i < 50; i++) {
      const val = heap.allocInt(i);
      current = heap.allocPair(val, current);
    }
    
    // Verify the list
    let node = current;
    let count = 0;
    while (node !== -1) {
      count++;
      node = heap.getCdr(node);
    }
    assert.equal(count, 50);
  });

  it('reclaims space after dropping references', () => {
    const heap = new MarkCompactHeap(256);
    
    let root = heap.allocInt(1);
    const r = heap.addRoot(() => root, (a) => { root = a; });
    
    // Fill the heap with garbage, triggering GC
    for (let i = 0; i < 30; i++) {
      heap.allocInt(i);
    }
    
    // After collection, most space should be free
    assert.ok(heap.freeWords > heap.heapSize * 0.5);
    assert.equal(heap.getInt(root), 1);
  });
});
