import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retry, withTimeout } from './retry.js';

describe('retry', () => {
  it('succeeds immediately', async () => {
    const result = await retry(async () => 42, { maxRetries: 3, baseDelay: 1 });
    assert.equal(result, 42);
  });

  it('retries on failure', async () => {
    let attempts = 0;
    const result = await retry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'success';
    }, { maxRetries: 5, baseDelay: 1, jitter: false });
    assert.equal(result, 'success');
    assert.equal(attempts, 3);
  });

  it('throws after max retries', async () => {
    await assert.rejects(
      () => retry(async () => { throw new Error('always fail'); }, { maxRetries: 2, baseDelay: 1, jitter: false }),
      /always fail/
    );
  });

  it('passes attempt number', async () => {
    const attempts = [];
    try {
      await retry(async (attempt) => { attempts.push(attempt); throw new Error('fail'); }, { maxRetries: 2, baseDelay: 1, jitter: false });
    } catch {}
    assert.deepStrictEqual(attempts, [0, 1, 2]);
  });

  it('calls onRetry', async () => {
    const retries = [];
    try {
      await retry(async () => { throw new Error('fail'); }, {
        maxRetries: 2, baseDelay: 1, jitter: false,
        onRetry: (err, attempt) => retries.push(attempt),
      });
    } catch {}
    assert.deepStrictEqual(retries, [1, 2]);
  });

  it('respects shouldRetry', async () => {
    let attempts = 0;
    await assert.rejects(() => retry(async () => {
      attempts++;
      throw new Error('nope');
    }, { maxRetries: 5, baseDelay: 1, shouldRetry: () => false }));
    assert.equal(attempts, 1); // no retries
  });

  it('abort signal', async () => {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(() => retry(async () => 42, { signal: ac.signal }), /Aborted/);
  });
});

describe('withTimeout', () => {
  it('succeeds within timeout', async () => {
    const result = await withTimeout(async () => 42, 1000);
    assert.equal(result, 42);
  });

  it('times out', async () => {
    await assert.rejects(
      () => withTimeout(() => new Promise(r => setTimeout(r, 500)), 10),
      /Timeout/
    );
  });
});

describe('Exponential backoff', () => {
  it('delay increases', async () => {
    const delays = [];
    try {
      await retry(async () => { throw new Error('fail'); }, {
        maxRetries: 3, baseDelay: 10, jitter: false, backoffFactor: 2,
        onRetry: (_, __, delay) => delays.push(delay),
      });
    } catch {}
    assert.ok(delays[1] > delays[0]); // second delay > first
    assert.ok(delays[2] > delays[1]); // third > second
  });
});
