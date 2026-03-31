import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retry, withRetry } from '../src/index.js';

describe('retry', () => {
  it('returns on success', async () => {
    const result = await retry(() => 42);
    assert.equal(result, 42);
  });
  it('retries on failure then succeeds', async () => {
    let attempts = 0;
    const result = await retry(() => { attempts++; if (attempts < 3) throw new Error('fail'); return 'ok'; }, { delay: 10 });
    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
  });
  it('throws after max retries', async () => {
    try { await retry(() => { throw new Error('always fail'); }, { maxRetries: 2, delay: 10 }); assert.fail(); }
    catch (e) { assert.equal(e.message, 'always fail'); }
  });
  it('calls onRetry', async () => {
    const retries = [];
    let a = 0;
    await retry(() => { a++; if (a < 2) throw new Error('e'); }, { delay: 10, onRetry: (err, n) => retries.push(n) });
    assert.deepEqual(retries, [1]);
  });
  it('retryIf filters', async () => {
    try {
      await retry(() => { throw new TypeError('no retry'); }, { delay: 10, retryIf: (e) => !(e instanceof TypeError) });
      assert.fail();
    } catch (e) { assert.ok(e instanceof TypeError); }
  });
});

describe('withRetry', () => {
  it('wraps function', async () => {
    let n = 0;
    const fn = withRetry(() => { n++; if (n < 2) throw new Error('e'); return 'ok'; }, { delay: 10 });
    assert.equal(await fn(), 'ok');
  });
});
