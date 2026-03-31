import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { LRUTTLCache } from '../src/index.js';
describe('LRU', () => {
  it('get/set', () => { const c = new LRUTTLCache(); c.set('a', 1); assert.equal(c.get('a'), 1); });
  it('evicts LRU', () => { const c = new LRUTTLCache({ max: 2 }); c.set('a', 1); c.set('b', 2); c.set('c', 3); assert.equal(c.get('a'), undefined); assert.equal(c.get('b'), 2); });
  it('refreshes on get', () => { const c = new LRUTTLCache({ max: 2 }); c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3); assert.equal(c.get('a'), 1); assert.equal(c.get('b'), undefined); });
  it('has', () => { const c = new LRUTTLCache(); c.set('a', 1); assert.ok(c.has('a')); assert.ok(!c.has('z')); });
  it('delete', () => { const c = new LRUTTLCache(); c.set('a', 1); c.delete('a'); assert.equal(c.size, 0); });
  it('clear', () => { const c = new LRUTTLCache(); c.set('a', 1); c.set('b', 2); c.clear(); assert.equal(c.size, 0); });
});
describe('TTL', () => {
  it('expires entries', async () => { const c = new LRUTTLCache({ ttl: 50 }); c.set('a', 1); await new Promise(r => setTimeout(r, 60)); assert.equal(c.get('a'), undefined); });
  it('per-key TTL', async () => { const c = new LRUTTLCache(); c.set('a', 1, 50); c.set('b', 2, 500); await new Promise(r => setTimeout(r, 60)); assert.equal(c.get('a'), undefined); assert.equal(c.get('b'), 2); });
});
