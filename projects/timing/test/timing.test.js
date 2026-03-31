import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { debounce, throttle, delay, sleep, timeout, measure } from '../src/index.js';

describe('debounce', () => {
  it('delays execution', async () => {
    let called = 0;
    const fn = debounce(() => called++, 50);
    fn(); fn(); fn();
    assert.equal(called, 0);
    await delay(80);
    assert.equal(called, 1);
  });
  it('cancel prevents execution', async () => {
    let called = 0;
    const fn = debounce(() => called++, 50);
    fn();
    fn.cancel();
    await delay(80);
    assert.equal(called, 0);
  });
});

describe('throttle', () => {
  it('limits call rate', async () => {
    let called = 0;
    const fn = throttle(() => called++, 50);
    fn(); fn(); fn();
    assert.equal(called, 1); // Only first (leading)
    await delay(80);
    assert.ok(called >= 1);
  });
});

describe('delay', () => {
  it('resolves after ms', async () => {
    const start = Date.now();
    await delay(50);
    assert.ok(Date.now() - start >= 40);
  });
});

describe('sleep', () => {
  it('resolves with value', async () => {
    const result = await sleep(10, 42);
    assert.equal(result, 42);
  });
});

describe('timeout', () => {
  it('resolves if fast enough', async () => {
    const result = await timeout(sleep(10, 'ok'), 100);
    assert.equal(result, 'ok');
  });
  it('rejects if too slow', async () => {
    try { await timeout(sleep(200), 50); assert.fail(); }
    catch (e) { assert.equal(e.message, 'Timeout'); }
  });
});

describe('measure', () => {
  it('returns result and duration', async () => {
    const { result, duration } = await measure(async () => { await delay(10); return 42; });
    assert.equal(result, 42);
    assert.ok(duration >= 5);
  });
});
