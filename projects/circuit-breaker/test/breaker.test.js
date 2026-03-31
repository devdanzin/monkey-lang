import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../src/index.js';

describe('CircuitBreaker', () => {
  it('starts closed', () => assert.equal(new CircuitBreaker().state, 'closed'));

  it('passes through on success', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(() => Promise.resolve(42));
    assert.equal(result, 42);
    assert.equal(cb.state, 'closed');
  });

  it('opens after threshold failures', async () => {
    const cb = new CircuitBreaker({ threshold: 3, timeout: 0 });
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(() => { throw new Error('fail'); }); } catch {}
    }
    assert.equal(cb.state, 'open');
  });

  it('rejects when open', async () => {
    const cb = new CircuitBreaker({ threshold: 1, timeout: 0, resetTimeout: 60000 });
    try { await cb.execute(() => { throw new Error('fail'); }); } catch {}
    assert.equal(cb.state, 'open');
    try { await cb.execute(() => 42); assert.fail(); }
    catch (e) { assert.equal(e.message, 'Circuit breaker is OPEN'); }
  });

  it('resets to closed on success after half-open', async () => {
    const cb = new CircuitBreaker({ threshold: 1, timeout: 0, resetTimeout: 10 });
    try { await cb.execute(() => { throw new Error('fail'); }); } catch {}
    assert.equal(cb.state, 'open');
    await new Promise(r => setTimeout(r, 20));
    const result = await cb.execute(() => Promise.resolve('ok'));
    assert.equal(result, 'ok');
    assert.equal(cb.state, 'closed');
  });

  it('calls onStateChange', async () => {
    const changes = [];
    const cb = new CircuitBreaker({ threshold: 1, timeout: 0, onStateChange: (n, o) => changes.push([n, o]) });
    try { await cb.execute(() => { throw new Error('fail'); }); } catch {}
    assert.deepEqual(changes[0], ['open', 'closed']);
  });

  it('manual reset', () => {
    const cb = new CircuitBreaker({ threshold: 1 });
    cb._state = 'open';
    cb.reset();
    assert.equal(cb.state, 'closed');
  });
});
