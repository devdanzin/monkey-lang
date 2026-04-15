import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MonkeyHash, MonkeyString, MonkeyInteger } from './object.js';

function makeHash(entries) {
  const pairs = new Map();
  for (const [k, v] of Object.entries(entries)) {
    const key = new MonkeyString(k);
    const hk = key.fastHashKey();
    pairs.set(hk, { key, value: new MonkeyInteger(v) });
  }
  return new MonkeyHash(pairs);
}

describe('MonkeyHash Shape IDs', () => {
  it('computes shape ID from keys', () => {
    const h = makeHash({ x: 1, y: 2 });
    const shapeId = h.shapeId;
    assert.ok(typeof shapeId === 'string');
    assert.ok(shapeId.length > 0);
  });

  it('same keys produce same shape ID', () => {
    const h1 = makeHash({ x: 1, y: 2 });
    const h2 = makeHash({ x: 10, y: 20 });
    assert.equal(h1.shapeId, h2.shapeId);
  });

  it('different keys produce different shape ID', () => {
    const h1 = makeHash({ x: 1, y: 2 });
    const h2 = makeHash({ x: 1, z: 2 });
    assert.notEqual(h1.shapeId, h2.shapeId);
  });

  it('key order does not matter for shape ID', () => {
    const h1 = makeHash({ a: 1, b: 2, c: 3 });
    const h2 = makeHash({ c: 30, a: 10, b: 20 });
    assert.equal(h1.shapeId, h2.shapeId);
  });

  it('shape ID is cached (lazy)', () => {
    const h = makeHash({ x: 1 });
    assert.equal(h._shapeId, null);
    const s1 = h.shapeId;
    assert.notEqual(h._shapeId, null);
    const s2 = h.shapeId;
    assert.equal(s1, s2);
  });

  it('invalidateShape clears cached shape', () => {
    const h = makeHash({ x: 1 });
    const s1 = h.shapeId;
    h.invalidateShape();
    assert.equal(h._shapeId, null);
    // Recomputes on next access
    const s2 = h.shapeId;
    assert.equal(s1, s2); // same keys, same shape
  });

  it('empty hash has a shape', () => {
    const h = new MonkeyHash(new Map());
    const shapeId = h.shapeId;
    assert.equal(shapeId, ''); // no keys = empty string
  });

  it('single key shape', () => {
    const h = makeHash({ name: 42 });
    assert.ok(h.shapeId.includes('name'));
  });
});
