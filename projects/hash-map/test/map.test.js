import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HashMap } from '../src/index.js';

describe('Basic operations', () => {
  it('set and get', () => {
    const m = new HashMap();
    m.set('a', 1).set('b', 2);
    assert.equal(m.get('a'), 1);
    assert.equal(m.get('b'), 2);
    assert.equal(m.get('c'), undefined);
  });
  it('has', () => {
    const m = new HashMap();
    m.set('x', 1);
    assert.equal(m.has('x'), true);
    assert.equal(m.has('y'), false);
  });
  it('size', () => {
    const m = new HashMap();
    assert.equal(m.size, 0);
    m.set('a', 1).set('b', 2);
    assert.equal(m.size, 2);
  });
  it('update existing key', () => {
    const m = new HashMap();
    m.set('a', 1).set('a', 2);
    assert.equal(m.get('a'), 2);
    assert.equal(m.size, 1);
  });
});

describe('Delete', () => {
  it('removes key', () => {
    const m = new HashMap();
    m.set('a', 1).set('b', 2);
    assert.equal(m.delete('a'), true);
    assert.equal(m.has('a'), false);
    assert.equal(m.size, 1);
  });
  it('handles deleted slots correctly', () => {
    const m = new HashMap(4);
    m.set('a', 1).set('b', 2).set('c', 3);
    m.delete('b');
    assert.equal(m.get('c'), 3); // Must probe past deleted slot
    m.set('d', 4);
    assert.equal(m.get('d'), 4);
  });
  it('missing key returns false', () => {
    assert.equal(new HashMap().delete('nope'), false);
  });
});

describe('Iteration', () => {
  it('keys', () => {
    const m = new HashMap();
    m.set('a', 1).set('b', 2);
    assert.deepEqual(m.keys().sort(), ['a', 'b']);
  });
  it('values', () => {
    const m = new HashMap();
    m.set('a', 1).set('b', 2);
    assert.deepEqual(m.values().sort(), [1, 2]);
  });
  it('entries', () => {
    const m = new HashMap();
    m.set('x', 10);
    assert.deepEqual(m.entries(), [['x', 10]]);
  });
  it('forEach', () => {
    const m = new HashMap();
    m.set('a', 1);
    const items = [];
    m.forEach((v, k) => items.push([k, v]));
    assert.deepEqual(items, [['a', 1]]);
  });
  it('iterator', () => {
    const m = new HashMap();
    m.set('a', 1);
    assert.deepEqual([...m], [['a', 1]]);
  });
});

describe('Auto-resize', () => {
  it('grows when load factor exceeded', () => {
    const m = new HashMap(4, 0.75); // Resize at 3 items
    m.set('a', 1).set('b', 2).set('c', 3).set('d', 4);
    assert.ok(m.capacity > 4);
    assert.equal(m.get('a'), 1);
    assert.equal(m.get('d'), 4);
  });
});

describe('Clear', () => {
  it('empties map', () => {
    const m = new HashMap();
    m.set('a', 1).set('b', 2);
    m.clear();
    assert.equal(m.size, 0);
    assert.equal(m.has('a'), false);
  });
});

describe('Performance', () => {
  it('handles 10000 entries', () => {
    const m = new HashMap();
    for (let i = 0; i < 10000; i++) m.set(`key${i}`, i);
    assert.equal(m.size, 10000);
    assert.equal(m.get('key5000'), 5000);
    assert.equal(m.get('key9999'), 9999);
  });
});

describe('Various key types', () => {
  it('number keys', () => {
    const m = new HashMap();
    m.set(42, 'answer');
    assert.equal(m.get(42), 'answer');
  });
});
