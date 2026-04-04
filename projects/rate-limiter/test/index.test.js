import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket, FixedWindow, SlidingWindowLog, SlidingWindowCounter } from '../src/index.js';

describe('TokenBucket', () => {
  it('allows requests within capacity', () => {
    const tb = new TokenBucket(5, 1);
    for (let i = 0; i < 5; i++) {
      assert.equal(tb.tryConsume().allowed, true);
    }
  });

  it('rejects when empty', () => {
    const tb = new TokenBucket(2, 1);
    tb.tryConsume(); tb.tryConsume();
    const result = tb.tryConsume();
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs > 0);
  });

  it('shows remaining', () => {
    const tb = new TokenBucket(5, 1);
    tb.tryConsume();
    assert.equal(tb.tryConsume().remaining, 3);
  });

  it('refills over time', async () => {
    const tb = new TokenBucket(2, 10, 100); // 10 tokens per 100ms
    tb.tryConsume(); tb.tryConsume();
    assert.equal(tb.tryConsume().allowed, false);
    await new Promise(r => setTimeout(r, 120));
    assert.equal(tb.tryConsume().allowed, true);
  });

  it('consumes multiple tokens', () => {
    const tb = new TokenBucket(10, 1);
    assert.equal(tb.tryConsume(5).allowed, true);
    assert.equal(tb.tryConsume(6).allowed, false);
    assert.equal(tb.tryConsume(5).allowed, true);
  });

  it('available property', () => {
    const tb = new TokenBucket(10, 1);
    assert.equal(tb.available, 10);
    tb.tryConsume(3);
    assert.equal(tb.available, 7);
  });
});

describe('FixedWindow', () => {
  it('allows within limit', () => {
    const fw = new FixedWindow(3, 1000);
    assert.equal(fw.tryConsume().allowed, true);
    assert.equal(fw.tryConsume().allowed, true);
    assert.equal(fw.tryConsume().allowed, true);
  });

  it('rejects over limit', () => {
    const fw = new FixedWindow(2, 1000);
    fw.tryConsume(); fw.tryConsume();
    assert.equal(fw.tryConsume().allowed, false);
  });

  it('per-key limits', () => {
    const fw = new FixedWindow(1, 1000);
    assert.equal(fw.tryConsume('user1').allowed, true);
    assert.equal(fw.tryConsume('user2').allowed, true);
    assert.equal(fw.tryConsume('user1').allowed, false);
  });

  it('getCount', () => {
    const fw = new FixedWindow(10, 1000);
    fw.tryConsume('x'); fw.tryConsume('x'); fw.tryConsume('x');
    assert.equal(fw.getCount('x'), 3);
  });
});

describe('SlidingWindowLog', () => {
  it('allows within limit', () => {
    const sw = new SlidingWindowLog(3, 1000);
    assert.equal(sw.tryConsume().allowed, true);
    assert.equal(sw.tryConsume().allowed, true);
    assert.equal(sw.tryConsume().allowed, true);
  });

  it('rejects over limit', () => {
    const sw = new SlidingWindowLog(2, 1000);
    sw.tryConsume(); sw.tryConsume();
    assert.equal(sw.tryConsume().allowed, false);
  });

  it('expires old entries', async () => {
    const sw = new SlidingWindowLog(2, 100);
    sw.tryConsume(); sw.tryConsume();
    assert.equal(sw.tryConsume().allowed, false);
    await new Promise(r => setTimeout(r, 120));
    assert.equal(sw.tryConsume().allowed, true);
  });

  it('per-key limits', () => {
    const sw = new SlidingWindowLog(1, 1000);
    assert.equal(sw.tryConsume('a').allowed, true);
    assert.equal(sw.tryConsume('b').allowed, true);
    assert.equal(sw.tryConsume('a').allowed, false);
  });

  it('getCount', () => {
    const sw = new SlidingWindowLog(10, 1000);
    sw.tryConsume('x'); sw.tryConsume('x');
    assert.equal(sw.getCount('x'), 2);
  });
});

describe('SlidingWindowCounter', () => {
  it('allows within limit', () => {
    const swc = new SlidingWindowCounter(5, 1000);
    for (let i = 0; i < 5; i++) {
      assert.equal(swc.tryConsume().allowed, true);
    }
  });

  it('rejects over limit', () => {
    const swc = new SlidingWindowCounter(2, 1000);
    swc.tryConsume(); swc.tryConsume();
    assert.equal(swc.tryConsume().allowed, false);
  });
});
