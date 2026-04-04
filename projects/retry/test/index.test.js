import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retry, retrySync } from '../src/index.js';

describe('retry', () => {
  it('succeeds first try', async () => {
    const result = await retry(() => 42, { maxRetries: 3, delay: 1 });
    assert.equal(result, 42);
  });

  it('retries on failure', async () => {
    let attempts = 0;
    const result = await retry(() => { if (++attempts < 3) throw new Error('fail'); return 'ok'; }, { maxRetries: 5, delay: 1 });
    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
  });

  it('throws after max retries', async () => {
    await assert.rejects(() => retry(() => { throw new Error('always fail'); }, { maxRetries: 2, delay: 1 }), { message: 'always fail' });
  });

  it('calls onRetry', async () => {
    const retries = [];
    await retry((a) => { if (a < 2) throw new Error('x'); return 'ok'; }, {
      maxRetries: 3, delay: 1, onRetry: (err, attempt) => retries.push(attempt),
    });
    assert.deepEqual(retries, [1, 2]);
  });

  it('passes attempt number', async () => {
    const attempts = [];
    await retry((a) => { attempts.push(a); if (a < 2) throw new Error('x'); return 'ok'; }, { maxRetries: 3, delay: 1 });
    assert.deepEqual(attempts, [0, 1, 2]);
  });
});

describe('retrySync', () => {
  it('succeeds', () => assert.equal(retrySync(() => 42), 42));
  it('retries', () => {
    let n = 0;
    assert.equal(retrySync(() => { if (++n < 3) throw new Error('x'); return 'ok'; }), 'ok');
  });
  it('throws after max', () => assert.throws(() => retrySync(() => { throw new Error('fail'); }, { maxRetries: 1 })));
});
