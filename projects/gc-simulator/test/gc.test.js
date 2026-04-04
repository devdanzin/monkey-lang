import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Heap, TAG, NIL } from '../src/index.js';

// ===== Basic Collection =====
describe('GC — basic collection', () => {
  it('collects when heap is empty', () => {
    const h = new Heap(64);
    h.collect();
    assert.equal(h.totalCollections, 1);
    assert.equal(h.usedWords, 0);
  });

  it('preserves rooted integer through GC', () => {
    const h = new Heap(64);
    const handle = h.pushRoot(h.allocInt(42));
    h.collect();
    assert.equal(h.intValue(handle.value), 42);
    assert.equal(h.totalCollections, 1);
    handle.release();
  });

  it('reclaims unreachable objects', () => {
    const h = new Heap(64);
    // Allocate some garbage
    h.allocInt(1);
    h.allocInt(2);
    h.allocInt(3);
    const usedBefore = h.usedWords;
    assert.ok(usedBefore > 0);
    
    // No roots → everything is garbage
    h.collect();
    assert.equal(h.usedWords, 0); // all reclaimed
  });

  it('preserves rooted pair and its children', () => {
    const h = new Heap(128);
    const a = h.allocInt(10);
    const b = h.allocInt(20);
    const p = h.allocPair(a, b);
    const handle = h.pushRoot(p);
    
    h.collect();
    
    // After GC, handle.value has the new address
    assert.equal(h.getTag(handle.value), TAG.PAIR);
    assert.equal(h.intValue(h.car(handle.value)), 10);
    assert.equal(h.intValue(h.cdr(handle.value)), 20);
    handle.release();
  });

  it('reclaims dead objects but keeps live ones', () => {
    const h = new Heap(128);
    h.allocInt(100); // garbage
    h.allocInt(200); // garbage
    const alive = h.allocInt(42);
    h.allocInt(300); // garbage
    
    const handle = h.pushRoot(alive);
    h.collect();
    
    // Only 1 INT survives (3 words)
    assert.equal(h.usedWords, 3);
    assert.equal(h.intValue(handle.value), 42);
    handle.release();
  });
});

// ===== Forwarding Pointers =====
describe('GC — forwarding pointers', () => {
  it('shared object is copied only once', () => {
    const h = new Heap(128);
    const shared = h.allocInt(99);
    const p1 = h.allocPair(shared, NIL);
    const p2 = h.allocPair(shared, NIL);
    const outer = h.allocPair(p1, p2);
    
    const handle = h.pushRoot(outer);
    h.collect();
    
    // Both children should reference the same copy of the shared int
    const newP1 = h.car(handle.value);
    const newP2 = h.cdr(handle.value);
    assert.equal(h.car(newP1), h.car(newP2));
    assert.equal(h.intValue(h.car(newP1)), 99);
    handle.release();
  });

  it('cyclic structure is handled correctly', () => {
    const h = new Heap(128);
    const p = h.allocPair(NIL, NIL);
    h.setCdr(p, p); // cycle: p.cdr → p
    
    const handle = h.pushRoot(p);
    h.collect();
    
    // After GC, the cycle should be preserved
    const newP = handle.value;
    assert.equal(h.cdr(newP), newP); // still points to itself
    handle.release();
  });

  it('multiple roots sharing objects', () => {
    const h = new Heap(128);
    const shared = h.allocInt(7);
    const handle1 = h.pushRoot(shared);
    
    const p = h.allocPair(shared, NIL);
    const handle2 = h.pushRoot(p);
    
    h.collect();
    
    // Both roots should point to the same copy
    assert.equal(handle1.value, h.car(handle2.value));
    assert.equal(h.intValue(handle1.value), 7);
    
    handle1.release();
    handle2.release();
  });
});

// ===== Linked Lists =====
describe('GC — linked lists', () => {
  it('preserves a linked list through GC', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const c = h.allocInt(3);
    const list = h.buildList([a, b, c]);
    
    const handle = h.pushRoot(list);
    h.collect();
    
    const arr = h.listToArray(handle.value);
    assert.equal(arr.length, 3);
    assert.equal(h.intValue(arr[0]), 1);
    assert.equal(h.intValue(arr[1]), 2);
    assert.equal(h.intValue(arr[2]), 3);
    handle.release();
  });

  it('reclaims removed list elements', () => {
    const h = new Heap(256);
    // Build [1, 2, 3, 4, 5]
    const elems = [];
    for (let i = 1; i <= 5; i++) elems.push(h.allocInt(i));
    const list = h.buildList(elems);
    
    // Root only cdr(cdr(list)) = [3, 4, 5], so 1 and 2 should be garbage
    const sublist = h.cdr(h.cdr(list));
    const handle = h.pushRoot(sublist);
    
    h.collect();
    
    const arr = h.listToArray(handle.value);
    assert.equal(arr.length, 3);
    assert.equal(h.intValue(arr[0]), 3);
    
    // Heap should only contain 3 INTs + 3 PAIRs = 3*3 + 3*4 = 21 words
    assert.equal(h.usedWords, 21);
    handle.release();
  });
});

// ===== Arrays =====
describe('GC — arrays', () => {
  it('preserves array and its elements', () => {
    const h = new Heap(256);
    const a = h.allocInt(10);
    const b = h.allocInt(20);
    const arr = h.allocArray([a, b]);
    
    const handle = h.pushRoot(arr);
    h.collect();
    
    assert.equal(h.arrayLength(handle.value), 2);
    assert.equal(h.intValue(h.arrayGet(handle.value, 0)), 10);
    assert.equal(h.intValue(h.arrayGet(handle.value, 1)), 20);
    handle.release();
  });

  it('array with NIL elements', () => {
    const h = new Heap(256);
    const arr = h.allocArray([NIL, NIL, NIL]);
    const handle = h.pushRoot(arr);
    h.collect();
    assert.equal(h.arrayLength(handle.value), 3);
    assert.equal(h.arrayGet(handle.value, 0), NIL);
    handle.release();
  });
});

// ===== Multiple GC Cycles =====
describe('GC — multiple collections', () => {
  it('survives multiple GC cycles', () => {
    const h = new Heap(128);
    const handle = h.pushRoot(h.allocInt(42));
    
    for (let i = 0; i < 5; i++) {
      h.allocInt(i * 100); // garbage each cycle
      h.collect();
      assert.equal(h.intValue(handle.value), 42);
    }
    assert.equal(h.totalCollections, 5);
    handle.release();
  });

  it('allocate-collect loop reclaims each cycle', () => {
    const h = new Heap(32);
    // 32 words total. Each INT = 3 words. Can fit ~10 INTs.
    // Without GC, 10 allocations would overflow.
    // With GC (no roots), each collect reclaims everything.
    for (let i = 0; i < 50; i++) {
      h.allocInt(i);
      h.collect(); // reclaim
    }
    assert.equal(h.totalAllocated, 50);
    assert.ok(h.totalCollections >= 50);
  });

  it('growing structure across GC cycles', () => {
    const h = new Heap(512);
    const handle = h.pushRoot(NIL);
    
    for (let i = 0; i < 10; i++) {
      const n = h.allocInt(i);
      handle.value = h.allocPair(n, handle.value);
      if (i % 3 === 0) h.collect(); // periodic GC
    }
    
    const arr = h.listToArray(handle.value);
    assert.equal(arr.length, 10);
    // List is in reverse order
    assert.equal(h.intValue(arr[0]), 9);
    assert.equal(h.intValue(arr[9]), 0);
    handle.release();
  });
});

// ===== Strings and Symbols =====
describe('GC — strings and symbols', () => {
  it('preserves strings through GC', () => {
    const h = new Heap(128);
    const s = h.allocString('hello');
    const handle = h.pushRoot(s);
    h.collect();
    assert.equal(h.stringValue(handle.value), 'hello');
    handle.release();
  });

  it('preserves symbols through GC', () => {
    const h = new Heap(128);
    const s = h.allocSymbol('foo');
    const handle = h.pushRoot(s);
    h.collect();
    assert.equal(h.stringValue(handle.value), 'foo');
    handle.release();
  });
});

// ===== Auto-GC on Allocation =====
describe('GC — auto-trigger', () => {
  it('auto-collects when space runs out', () => {
    const h = new Heap(32);
    // Allocate enough to fill the space (each INT = 3 words, 32/3 ≈ 10)
    const handle = h.pushRoot(h.allocInt(42));
    
    // Fill up with garbage (not rooted)
    for (let i = 0; i < 8; i++) {
      h.allocInt(i);
    }
    
    // This should trigger auto-GC
    const before = h.totalCollections;
    const extra = h.allocInt(99); // might trigger GC
    
    // The rooted value should still be intact
    assert.equal(h.intValue(handle.value), 42);
    handle.release();
  });
});

// ===== Stats =====
describe('GC — statistics', () => {
  it('tracks totalCopied', () => {
    const h = new Heap(128);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const p = h.allocPair(a, b);
    const handle = h.pushRoot(p);
    
    h.collect();
    
    // Should have copied: p, a, b = 3 objects
    assert.equal(h.totalCopied, 3);
    handle.release();
  });

  it('utilization reflects heap usage', () => {
    const h = new Heap(100);
    assert.equal(h.utilization, 0);
    h.allocInt(1); // 3 words
    assert.equal(h.utilization, 0.03);
  });
});

// ===== Stress Test =====
describe('GC — stress', () => {
  it('handles many allocations with periodic GC', () => {
    const h = new Heap(1024);
    const handle = h.pushRoot(NIL);
    
    // Build a long list across many GC cycles
    for (let i = 0; i < 100; i++) {
      const n = h.allocInt(i);
      handle.value = h.allocPair(n, handle.value);
      if (i % 10 === 0) h.collect();
    }
    
    h.collect(); // final cleanup
    const arr = h.listToArray(handle.value);
    assert.equal(arr.length, 100);
    assert.equal(h.intValue(arr[0]), 99);
    assert.equal(h.intValue(arr[99]), 0);
    handle.release();
  });

  it('tree structure survives GC', () => {
    const h = new Heap(512);
    // Build a binary tree
    function makeTree(depth) {
      if (depth === 0) return h.allocInt(depth);
      const left = makeTree(depth - 1);
      const lh = h.pushRoot(left);
      const right = makeTree(depth - 1);
      const rh = h.pushRoot(right);
      const node = h.allocPair(lh.value, rh.value);
      lh.release();
      rh.release();
      return node;
    }
    
    const tree = makeTree(4); // 2^4 - 1 = 15 internal nodes + 16 leaves
    const handle = h.pushRoot(tree);
    h.collect();
    
    // Verify structure preserved
    assert.equal(h.getTag(handle.value), TAG.PAIR);
    assert.equal(h.getTag(h.car(handle.value)), TAG.PAIR); // left subtree
    handle.release();
  });
});

// ===== Edge Cases =====
describe('GC — edge cases', () => {
  it('empty array survives GC', () => {
    const h = new Heap(128);
    const arr = h.allocArray([]);
    const handle = h.pushRoot(arr);
    h.collect();
    assert.equal(h.arrayLength(handle.value), 0);
    handle.release();
  });

  it('deeply nested pairs survive GC', () => {
    const h = new Heap(512);
    // Build (((42)))
    let val = h.allocInt(42);
    for (let i = 0; i < 10; i++) {
      val = h.allocPair(val, NIL);
    }
    const handle = h.pushRoot(val);
    h.collect();
    
    // Unwrap 10 times
    let cur = handle.value;
    for (let i = 0; i < 10; i++) {
      assert.equal(h.getTag(cur), TAG.PAIR);
      cur = h.car(cur);
    }
    assert.equal(h.intValue(cur), 42);
    handle.release();
  });

  it('mixed types in array survive GC', () => {
    const h = new Heap(256);
    const n = h.allocInt(1);
    const s = h.allocString('hello');
    const p = h.allocPair(n, NIL);
    const arr = h.allocArray([n, s, p, NIL]);
    const handle = h.pushRoot(arr);
    h.collect();
    
    assert.equal(h.intValue(h.arrayGet(handle.value, 0)), 1);
    assert.equal(h.stringValue(h.arrayGet(handle.value, 1)), 'hello');
    assert.equal(h.getTag(h.arrayGet(handle.value, 2)), TAG.PAIR);
    assert.equal(h.arrayGet(handle.value, 3), NIL);
    handle.release();
  });

  it('releasing root allows object to be collected', () => {
    const h = new Heap(64);
    const handle = h.pushRoot(h.allocInt(42));
    handle.release();
    h.collect();
    assert.equal(h.usedWords, 0); // nothing retained
  });

  it('heap overflow throws after GC attempt', () => {
    const h = new Heap(16);
    // Root everything to prevent GC from reclaiming
    const handles = [];
    for (let i = 0; i < 5; i++) {
      handles.push(h.pushRoot(h.allocInt(i)));
    }
    // 15 of 16 words used, try to allocate more — should fail even after GC
    assert.throws(() => {
      h.allocInt(99);
    }, /Heap overflow/);
    for (const h2 of handles) h2.release();
  });
});
