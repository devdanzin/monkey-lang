import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache, TTLCache } from '../src/index.js';

describe('LRUCache — basic', () => {
  it('put and get', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1);
    assert.equal(cache.get('a'), 1);
  });

  it('returns undefined for missing', () => {
    const cache = new LRUCache(3);
    assert.equal(cache.get('x'), undefined);
  });

  it('has() works', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('b'), false);
  });

  it('tracks size', () => {
    const cache = new LRUCache(5);
    cache.put('a', 1); cache.put('b', 2);
    assert.equal(cache.size, 2);
  });

  it('updates existing key', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1);
    cache.put('a', 2);
    assert.equal(cache.get('a'), 2);
    assert.equal(cache.size, 1);
  });
});

describe('LRUCache — eviction', () => {
  it('evicts LRU when full', () => {
    const cache = new LRUCache(2);
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3); // evicts 'a'
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
  });

  it('access updates recency', () => {
    const cache = new LRUCache(2);
    cache.put('a', 1);
    cache.put('b', 2);
    cache.get('a'); // 'a' is now MRU
    cache.put('c', 3); // evicts 'b' (LRU)
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('c'), 3);
  });

  it('update resets recency', () => {
    const cache = new LRUCache(2);
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('a', 10); // updates 'a', makes it MRU
    cache.put('c', 3);  // evicts 'b'
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 10);
  });

  it('capacity 1', () => {
    const cache = new LRUCache(1);
    cache.put('a', 1);
    cache.put('b', 2);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), 2);
  });
});

describe('LRUCache — delete & clear', () => {
  it('deletes key', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1);
    assert.equal(cache.delete('a'), true);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.size, 0);
  });

  it('delete returns false for missing', () => {
    const cache = new LRUCache(3);
    assert.equal(cache.delete('x'), false);
  });

  it('clear removes all', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1); cache.put('b', 2);
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.get('a'), undefined);
  });
});

describe('LRUCache — ordering', () => {
  it('keys() returns MRU→LRU', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);
    assert.deepEqual(cache.keys(), ['c', 'b', 'a']);
  });

  it('lruKey and mruKey', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1); cache.put('b', 2); cache.put('c', 3);
    assert.equal(cache.mruKey, 'c');
    assert.equal(cache.lruKey, 'a');
  });

  it('peek does not change order', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1); cache.put('b', 2);
    assert.equal(cache.peek('a'), 1);
    assert.equal(cache.mruKey, 'b'); // 'a' wasn't promoted
  });

  it('entries() returns ordered pairs', () => {
    const cache = new LRUCache(3);
    cache.put('x', 10); cache.put('y', 20);
    assert.deepEqual(cache.entries(), [['y', 20], ['x', 10]]);
  });

  it('iterator works', () => {
    const cache = new LRUCache(3);
    cache.put('a', 1); cache.put('b', 2);
    const items = [...cache];
    assert.deepEqual(items, [['b', 2], ['a', 1]]);
  });
});

describe('LRUCache — stress', () => {
  it('handles 1000 operations', () => {
    const cache = new LRUCache(100);
    for (let i = 0; i < 1000; i++) cache.put(`key${i}`, i);
    assert.equal(cache.size, 100);
    // Only last 100 should be present
    assert.equal(cache.has('key999'), true);
    assert.equal(cache.has('key0'), false);
  });
});

describe('TTLCache', () => {
  it('returns value before expiry', () => {
    const cache = new TTLCache(10, 1000);
    cache.put('a', 1);
    assert.equal(cache.get('a'), 1);
  });

  it('expires after TTL', async () => {
    const cache = new TTLCache(10);
    cache.put('a', 1, 50); // 50ms TTL
    assert.equal(cache.get('a'), 1);
    
    await new Promise(r => setTimeout(r, 60));
    assert.equal(cache.get('a'), undefined);
  });

  it('has returns false after expiry', async () => {
    const cache = new TTLCache(10);
    cache.put('a', 1, 30);
    await new Promise(r => setTimeout(r, 40));
    assert.equal(cache.has('a'), false);
  });
});

describe('LRUCache — edge cases', () => {
  it('throws on invalid capacity', () => {
    assert.throws(() => new LRUCache(0));
    assert.throws(() => new LRUCache(-1));
  });

  it('empty cache operations', () => {
    const cache = new LRUCache(3);
    assert.equal(cache.lruKey, undefined);
    assert.equal(cache.mruKey, undefined);
    assert.deepEqual(cache.keys(), []);
  });
});
