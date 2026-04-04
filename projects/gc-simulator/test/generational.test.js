import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GenerationalHeap, isTenuredAddr } from '../src/generational.js';

describe('Generational GC — basic', () => {
  it('allocates in nursery', () => {
    const heap = new GenerationalHeap(128, 512);
    const addr = heap.allocInt(42);
    assert.equal(heap.getInt(addr), 42);
    assert.equal(isTenuredAddr(addr), false);
  });

  it('allocates pairs', () => {
    const heap = new GenerationalHeap(128, 512);
    const a = heap.allocInt(1);
    const b = heap.allocInt(2);
    const p = heap.allocPair(a, b);
    assert.equal(heap.getInt(heap.getCar(p)), 1);
    assert.equal(heap.getInt(heap.getCdr(p)), 2);
  });

  it('allocates arrays', () => {
    const heap = new GenerationalHeap(128, 512);
    const a = heap.allocInt(10);
    const b = heap.allocInt(20);
    const arr = heap.allocArray([a, b]);
    assert.equal(heap.getArrayLength(arr), 2);
    assert.equal(heap.getInt(heap.getArrayElement(arr, 0)), 10);
  });

  it('allocates strings', () => {
    const heap = new GenerationalHeap(128, 512);
    const s = heap.allocString('hello');
    assert.equal(heap.getString(s), 'hello');
  });
});

describe('Generational GC — nursery collection', () => {
  it('collects nursery garbage', () => {
    const heap = new GenerationalHeap(32, 512);
    
    // Allocate garbage
    heap.allocInt(1);
    heap.allocInt(2);
    
    let root = heap.allocInt(42);
    heap.addRoot(() => root, (a) => { root = a; });
    
    // Force nursery collection
    heap._collectNursery();
    
    assert.equal(heap.getInt(root), 42);
    assert.ok(heap.stats.nurseryCollections >= 1);
  });

  it('preserves pair chain across nursery collection', () => {
    const heap = new GenerationalHeap(128, 512);
    
    const a = heap.allocInt(1);
    const b = heap.allocInt(2);
    let pair = heap.allocPair(a, heap.allocPair(b, -1));
    heap.addRoot(() => pair, (v) => { pair = v; });
    
    heap._collectNursery();
    
    assert.equal(heap.getInt(heap.getCar(pair)), 1);
    const cdr = heap.getCdr(pair);
    assert.equal(heap.getInt(heap.getCar(cdr)), 2);
  });
});

describe('Generational GC — promotion', () => {
  it('promotes objects after surviving enough collections', () => {
    const heap = new GenerationalHeap(64, 512, 2); // promote after 2 collections
    
    let root = heap.allocInt(42);
    heap.addRoot(() => root, (a) => { root = a; });
    
    // First collection — survives, age 1
    heap._collectNursery();
    assert.equal(isTenuredAddr(root), false);
    
    // Second collection — age reaches 2, promoted
    heap._collectNursery();
    assert.equal(isTenuredAddr(root), true);
    assert.equal(heap.getInt(root), 42);
    assert.ok(heap.stats.promotions >= 1);
  });

  it('promotes pair with children', () => {
    const heap = new GenerationalHeap(128, 512, 2);
    
    const a = heap.allocInt(10);
    const b = heap.allocInt(20);
    let pair = heap.allocPair(a, b);
    heap.addRoot(() => pair, (v) => { pair = v; });
    
    // Two collections to promote
    heap._collectNursery();
    heap._collectNursery();
    
    assert.equal(isTenuredAddr(pair), true);
    assert.equal(heap.getInt(heap.getCar(pair)), 10);
    assert.equal(heap.getInt(heap.getCdr(pair)), 20);
  });
});

describe('Generational GC — write barrier', () => {
  it('tracks tenured → nursery pointers', () => {
    const heap = new GenerationalHeap(128, 512, 1); // promote after 1 collection
    
    let oldPair = heap.allocPair(-1, -1);
    heap.addRoot(() => oldPair, (v) => { oldPair = v; });
    
    // Promote the pair
    heap._collectNursery();
    assert.equal(isTenuredAddr(oldPair), true);
    
    // Allocate new young object and store in tenured pair
    const young = heap.allocInt(99);
    heap.setCar(oldPair, young); // triggers write barrier
    
    assert.ok(heap.stats.writeBarriers >= 1);
    
    // Nursery collection should preserve the young object
    heap._collectNursery();
    
    const car = heap.getCar(oldPair);
    assert.equal(heap.getInt(car), 99);
  });
});

describe('Generational GC — tenured collection', () => {
  it('collects tenured garbage', () => {
    const heap = new GenerationalHeap(64, 256, 1);
    
    // Create and promote some objects
    let root = heap.allocInt(42);
    heap.addRoot(() => root, (v) => { root = v; });
    heap._collectNursery(); // promotes to tenured
    
    // Create more tenured garbage
    for (let i = 0; i < 10; i++) {
      heap.allocInt(i);
      heap._collectNursery(); // each promotes
    }
    
    const tenuredBefore = heap.tenuredUsed;
    
    // Remove all roots except the one we care about
    // (The other objects are in tenured but unreachable from our root)
    heap._collectTenured();
    
    assert.equal(heap.getInt(root), 42);
    assert.ok(heap.stats.tenuredCollections >= 1);
  });
});

describe('Generational GC — stress', () => {
  it('survives many allocations with mixed generations', () => {
    const heap = new GenerationalHeap(512, 2048, 3);
    
    let list = -1; // NIL
    const root = heap.addRoot(() => list, (a) => { list = a; });
    
    // Build a linked list of 15 elements
    for (let i = 0; i < 15; i++) {
      const val = heap.allocInt(i);
      list = heap.allocPair(val, list);
    }
    
    // Verify the list
    let node = list;
    let count = 0;
    while (node !== -1) {
      count++;
      node = heap.getCdr(node);
    }
    assert.equal(count, 15);
  });

  it('handles promotion of objects pointing to other nursery objects', () => {
    const heap = new GenerationalHeap(256, 1024, 2);
    
    // Allocate inner and outer together
    const inner = heap.allocInt(100);
    let outer = heap.allocPair(inner, -1);
    heap.addRoot(() => outer, (v) => { outer = v; });
    
    // First collection: survive
    heap._collectNursery();
    
    // Second collection: promote
    heap._collectNursery();
    
    // Outer should be tenured
    assert.equal(isTenuredAddr(outer), true);
    // Check the car still works
    const car = heap.getCar(outer);
    assert.equal(heap.getInt(car), 100);
  });

  it('stats accumulate correctly', () => {
    const heap = new GenerationalHeap(64, 512, 2);
    
    let root = heap.allocInt(1);
    heap.addRoot(() => root, (v) => { root = v; });
    
    for (let i = 0; i < 50; i++) {
      heap.allocInt(i * 10);
    }
    
    assert.ok(heap.stats.nurseryCollections > 0);
    assert.ok(heap.stats.totalAllocated > 50);
  });
});
