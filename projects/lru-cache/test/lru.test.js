import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache } from '../src/index.js';

describe('Basic operations', () => {
  it('set and get', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1).set('b', 2);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), undefined);
  });

  it('has', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('b'), false);
  });

  it('delete', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    assert.equal(cache.delete('a'), true);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.delete('b'), false);
  });

  it('size', () => {
    const cache = new LRUCache(3);
    assert.equal(cache.size, 0);
    cache.set('a', 1);
    assert.equal(cache.size, 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
  });

  it('clear', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1).set('b', 2);
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.get('a'), undefined);
  });
});

describe('Eviction', () => {
  it('evicts LRU when full', () => {
    const cache = new LRUCache(2);
    cache.set('a', 1).set('b', 2);
    cache.set('c', 3); // Should evict 'a'
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('b'), true);
    assert.equal(cache.has('c'), true);
  });

  it('get refreshes entry', () => {
    const cache = new LRUCache(2);
    cache.set('a', 1).set('b', 2);
    cache.get('a'); // Refresh 'a'
    cache.set('c', 3); // Should evict 'b' (not 'a')
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('b'), false);
  });

  it('set refreshes existing entry', () => {
    const cache = new LRUCache(2);
    cache.set('a', 1).set('b', 2);
    cache.set('a', 10); // Refresh + update 'a'
    cache.set('c', 3); // Should evict 'b'
    assert.equal(cache.get('a'), 10);
    assert.equal(cache.has('b'), false);
  });

  it('onEvict callback', () => {
    const evicted = [];
    const cache = new LRUCache(2, { onEvict: (k, v) => evicted.push([k, v]) });
    cache.set('a', 1).set('b', 2);
    cache.set('c', 3);
    assert.deepEqual(evicted, [['a', 1]]);
  });
});

describe('Peek', () => {
  it('does not change order', () => {
    const cache = new LRUCache(2);
    cache.set('a', 1).set('b', 2);
    assert.equal(cache.peek('a'), 1);
    cache.set('c', 3); // Should still evict 'a' (peek didn't refresh)
    assert.equal(cache.has('a'), false);
  });
});

describe('Iteration', () => {
  it('keys() most recent first', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1).set('b', 2).set('c', 3);
    assert.deepEqual(cache.keys(), ['c', 'b', 'a']);
  });

  it('values()', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1).set('b', 2);
    assert.deepEqual(cache.values(), [2, 1]);
  });

  it('entries()', () => {
    const cache = new LRUCache(2);
    cache.set('x', 10).set('y', 20);
    assert.deepEqual(cache.entries(), [['y', 20], ['x', 10]]);
  });

  it('forEach', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1).set('b', 2);
    const items = [];
    cache.forEach((v, k) => items.push([k, v]));
    assert.deepEqual(items, [['b', 2], ['a', 1]]);
  });
});

describe('Resize', () => {
  it('shrinks and evicts', () => {
    const cache = new LRUCache(5);
    for (let i = 0; i < 5; i++) cache.set(i, i);
    cache.resize(2);
    assert.equal(cache.size, 2);
    assert.equal(cache.has(4), true);
    assert.equal(cache.has(3), true);
    assert.equal(cache.has(0), false);
  });
});

describe('Edge cases', () => {
  it('capacity 1', () => {
    const cache = new LRUCache(1);
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.size, 1);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('a'), undefined);
  });

  it('rejects capacity 0', () => {
    assert.throws(() => new LRUCache(0));
  });

  it('chaining', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1).set('b', 2).set('c', 3);
    assert.equal(cache.size, 3);
  });
});

describe('Performance', () => {
  it('handles 100k operations', () => {
    const cache = new LRUCache(1000);
    for (let i = 0; i < 100000; i++) {
      cache.set(i % 2000, i);
    }
    assert.equal(cache.size, 1000);
  });
});
