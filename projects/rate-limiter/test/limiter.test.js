import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket, SlidingWindow, FixedWindow, KeyedRateLimiter } from '../src/index.js';

describe('TokenBucket', () => {
  it('allows requests within capacity', () => {
    const tb = new TokenBucket({ capacity: 5, refillRate: 1, refillInterval: 1000 });
    for (let i = 0; i < 5; i++) assert.equal(tb.tryConsume(), true);
    assert.equal(tb.tryConsume(), false);
  });
  it('reports available tokens', () => {
    const tb = new TokenBucket({ capacity: 3, refillRate: 1, refillInterval: 1000 });
    assert.equal(tb.available, 3);
    tb.tryConsume();
    assert.equal(tb.available, 2);
  });
  it('consumes multiple at once', () => {
    const tb = new TokenBucket({ capacity: 10, refillRate: 1, refillInterval: 1000 });
    assert.equal(tb.tryConsume(5), true);
    assert.equal(tb.tryConsume(6), false);
    assert.equal(tb.tryConsume(5), true);
  });
});

describe('SlidingWindow', () => {
  it('allows requests within window', () => {
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 3 });
    assert.equal(sw.tryConsume(), true);
    assert.equal(sw.tryConsume(), true);
    assert.equal(sw.tryConsume(), true);
    assert.equal(sw.tryConsume(), false);
  });
  it('reports available', () => {
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 5 });
    assert.equal(sw.available, 5);
    sw.tryConsume();
    assert.equal(sw.available, 4);
  });
});

describe('FixedWindow', () => {
  it('allows requests within window', () => {
    const fw = new FixedWindow({ windowMs: 1000, maxRequests: 2 });
    assert.equal(fw.tryConsume(), true);
    assert.equal(fw.tryConsume(), true);
    assert.equal(fw.tryConsume(), false);
  });
  it('reports available', () => {
    const fw = new FixedWindow({ windowMs: 1000, maxRequests: 3 });
    assert.equal(fw.available, 3);
  });
});

describe('KeyedRateLimiter', () => {
  it('per-key limiting', () => {
    const krl = new KeyedRateLimiter(() => new FixedWindow({ windowMs: 1000, maxRequests: 2 }));
    assert.equal(krl.tryConsume('user1'), true);
    assert.equal(krl.tryConsume('user1'), true);
    assert.equal(krl.tryConsume('user1'), false);
    assert.equal(krl.tryConsume('user2'), true); // Different key
  });
  it('reset', () => {
    const krl = new KeyedRateLimiter(() => new FixedWindow({ windowMs: 1000, maxRequests: 1 }));
    krl.tryConsume('x');
    assert.equal(krl.tryConsume('x'), false);
    krl.reset('x');
    assert.equal(krl.tryConsume('x'), true);
  });
});
