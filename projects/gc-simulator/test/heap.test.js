import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Heap, TAG, NIL } from '../src/index.js';

// ===== Basic Allocation =====
describe('Heap — allocation', () => {
  it('allocates an integer', () => {
    const h = new Heap(256);
    const addr = h.allocInt(42);
    assert.equal(h.getTag(addr), TAG.INT);
    assert.equal(h.intValue(addr), 42);
  });

  it('allocates multiple integers', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const c = h.allocInt(3);
    assert.equal(h.intValue(a), 1);
    assert.equal(h.intValue(b), 2);
    assert.equal(h.intValue(c), 3);
    assert.notEqual(a, b);
    assert.notEqual(b, c);
  });

  it('allocates a pair (cons cell)', () => {
    const h = new Heap(256);
    const a = h.allocInt(10);
    const b = h.allocInt(20);
    const p = h.allocPair(a, b);
    assert.equal(h.getTag(p), TAG.PAIR);
    assert.equal(h.car(p), a);
    assert.equal(h.cdr(p), b);
  });

  it('allocates nil', () => {
    const h = new Heap(256);
    const n = h.allocNil();
    assert.equal(h.getTag(n), TAG.NIL);
    assert.equal(h.isNil(n), true);
  });

  it('NIL sentinel is recognized', () => {
    const h = new Heap(256);
    assert.equal(h.isNil(NIL), true);
  });

  it('allocates an array', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const arr = h.allocArray([a, b, NIL]);
    assert.equal(h.getTag(arr), TAG.ARRAY);
    assert.equal(h.arrayLength(arr), 3);
    assert.equal(h.arrayGet(arr, 0), a);
    assert.equal(h.arrayGet(arr, 1), b);
    assert.equal(h.arrayGet(arr, 2), NIL);
  });

  it('allocates a string', () => {
    const h = new Heap(256);
    const s = h.allocString('hello');
    assert.equal(h.getTag(s), TAG.STRING);
    assert.equal(h.stringValue(s), 'hello');
  });

  it('allocates a symbol', () => {
    const h = new Heap(256);
    const s = h.allocSymbol('foo');
    assert.equal(h.getTag(s), TAG.SYMBOL);
    assert.equal(h.stringValue(s), 'foo');
  });

  it('tracks used/free words', () => {
    const h = new Heap(256);
    assert.equal(h.usedWords, 0);
    assert.equal(h.freeWords, 256);
    h.allocInt(42); // 2 header + 1 field = 3 words
    assert.equal(h.usedWords, 3);
    assert.equal(h.freeWords, 253);
  });

  it('tracks allocation count', () => {
    const h = new Heap(256);
    h.allocInt(1);
    h.allocInt(2);
    h.allocPair(NIL, NIL);
    assert.equal(h.totalAllocated, 3);
  });
});

// ===== Field Access =====
describe('Heap — field access', () => {
  it('setCar/setCdr modify pair', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const c = h.allocInt(3);
    const p = h.allocPair(a, b);
    assert.equal(h.car(p), a);
    h.setCar(p, c);
    assert.equal(h.car(p), c);
    h.setCdr(p, NIL);
    assert.equal(h.cdr(p), NIL);
  });

  it('arraySet modifies array element', () => {
    const h = new Heap(256);
    const a = h.allocInt(10);
    const b = h.allocInt(20);
    const arr = h.allocArray([a, NIL]);
    h.arraySet(arr, 1, b);
    assert.equal(h.arrayGet(arr, 1), b);
  });

  it('getField/setField work generically', () => {
    const h = new Heap(256);
    const p = h.allocPair(NIL, NIL);
    h.setField(p, 0, 99);
    assert.equal(h.getField(p, 0), 99);
  });
});

// ===== List Utilities =====
describe('Heap — list utilities', () => {
  it('buildList creates a linked list', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const c = h.allocInt(3);
    const list = h.buildList([a, b, c]);
    assert.equal(h.getTag(list), TAG.PAIR);
    assert.equal(h.car(list), a);
    const rest = h.cdr(list);
    assert.equal(h.car(rest), b);
    assert.equal(h.car(h.cdr(rest)), c);
    assert.equal(h.cdr(h.cdr(rest)), NIL);
  });

  it('listToArray converts back to JS array', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const list = h.buildList([a, b]);
    const arr = h.listToArray(list);
    assert.equal(arr.length, 2);
    assert.equal(h.intValue(arr[0]), 1);
    assert.equal(h.intValue(arr[1]), 2);
  });

  it('empty list is NIL', () => {
    const h = new Heap(256);
    const list = h.buildList([]);
    assert.equal(list, NIL);
  });
});

// ===== Root Management =====
describe('Heap — root management', () => {
  it('pushRoot creates a handle', () => {
    const h = new Heap(256);
    const addr = h.allocInt(42);
    const handle = h.pushRoot(addr);
    assert.equal(handle.value, addr);
    assert.equal(h.roots.length, 1);
    handle.release();
    assert.equal(h.roots.length, 0);
  });

  it('addRoot with get/set', () => {
    const h = new Heap(256);
    let myRoot = h.allocInt(10);
    const root = h.addRoot(() => myRoot, (v) => { myRoot = v; });
    assert.equal(h.roots.length, 1);
    h.removeRoot(root);
    assert.equal(h.roots.length, 0);
  });
});

// ===== Inspect =====
describe('Heap — inspect', () => {
  it('inspects integer', () => {
    const h = new Heap(256);
    const a = h.allocInt(42);
    assert.equal(h.inspect(a), '42');
  });

  it('inspects pair', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const p = h.allocPair(a, b);
    assert.equal(h.inspect(p), '(1 . 2)');
  });

  it('inspects NIL', () => {
    const h = new Heap(256);
    assert.equal(h.inspect(NIL), 'nil');
  });

  it('inspects array', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const arr = h.allocArray([a, b]);
    assert.equal(h.inspect(arr), '[1, 2]');
  });

  it('inspects string', () => {
    const h = new Heap(256);
    const s = h.allocString('hello');
    assert.equal(h.inspect(s), '"hello"');
  });

  it('inspects symbol', () => {
    const h = new Heap(256);
    const s = h.allocSymbol('foo');
    assert.equal(h.inspect(s), ':foo');
  });

  it('inspects nested structure', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    const b = h.allocInt(2);
    const inner = h.allocPair(a, b);
    const outer = h.allocPair(inner, NIL);
    // This will show the inner pair by following the pointer
    const result = h.inspect(outer);
    assert.ok(result.includes('1'));
    assert.ok(result.includes('2'));
  });
});

// ===== Error Cases =====
describe('Heap — error cases', () => {
  it('intValue throws on non-INT', () => {
    const h = new Heap(256);
    const p = h.allocPair(NIL, NIL);
    assert.throws(() => h.intValue(p), /Not an INT/);
  });

  it('car throws on non-PAIR', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    assert.throws(() => h.car(a), /Not a PAIR/);
  });

  it('arrayLength throws on non-ARRAY', () => {
    const h = new Heap(256);
    const a = h.allocInt(1);
    assert.throws(() => h.arrayLength(a), /Not an ARRAY/);
  });
});
