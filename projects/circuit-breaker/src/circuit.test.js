import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitBreakerError, State, Bulkhead } from './circuit.js';

describe('CircuitBreaker', () => {
  it('executes successfully', async () => {
    const cb = new CircuitBreaker(async () => 42);
    assert.equal(await cb.execute(), 42);
  });

  it('starts closed', () => {
    const cb = new CircuitBreaker(() => {});
    assert.equal(cb.state, State.CLOSED);
  });

  it('opens after failures', async () => {
    const cb = new CircuitBreaker(async () => { throw new Error('fail'); }, { failureThreshold: 3 });
    for (let i = 0; i < 3; i++) { try { await cb.execute(); } catch {} }
    assert.equal(cb.state, State.OPEN);
  });

  it('rejects when open', async () => {
    const cb = new CircuitBreaker(async () => { throw new Error('fail'); }, { failureThreshold: 1 });
    try { await cb.execute(); } catch {}
    await assert.rejects(() => cb.execute(), CircuitBreakerError);
  });

  it('transitions to half-open after timeout', async () => {
    const cb = new CircuitBreaker(async () => 42, { failureThreshold: 1, timeout: 10 });
    cb.open();
    await new Promise(r => setTimeout(r, 15));
    assert.equal(await cb.execute(), 42);
    assert.equal(cb.state, State.HALF_OPEN);
  });

  it('closes from half-open after successes', async () => {
    const cb = new CircuitBreaker(async () => 42, { failureThreshold: 1, timeout: 10, successThreshold: 2 });
    cb.open();
    await new Promise(r => setTimeout(r, 15));
    await cb.execute();
    await cb.execute();
    assert.equal(cb.state, State.CLOSED);
  });

  it('re-opens from half-open on failure', async () => {
    let fail = true;
    const cb = new CircuitBreaker(async () => { if (fail) throw new Error('fail'); return 42; }, { failureThreshold: 1, timeout: 10 });
    cb.open();
    await new Promise(r => setTimeout(r, 15));
    try { await cb.execute(); } catch {}
    assert.equal(cb.state, State.OPEN);
  });

  it('reset', async () => {
    const cb = new CircuitBreaker(async () => { throw new Error('fail'); }, { failureThreshold: 1 });
    try { await cb.execute(); } catch {}
    cb.reset();
    assert.equal(cb.state, State.CLOSED);
  });

  it('emits events', async () => {
    const events = [];
    const cb = new CircuitBreaker(async () => 42);
    cb.on('success', () => events.push('success'));
    await cb.execute();
    assert.deepStrictEqual(events, ['success']);
  });

  it('stats', async () => {
    const cb = new CircuitBreaker(async () => { throw new Error('fail'); }, { failureThreshold: 5 });
    try { await cb.execute(); } catch {}
    assert.equal(cb.stats.failures, 1);
    assert.equal(cb.stats.state, State.CLOSED);
  });
});

describe('Bulkhead', () => {
  it('limits concurrency', async () => {
    const bh = new Bulkhead(2);
    let concurrent = 0, maxConcurrent = 0;
    const task = () => new Promise(r => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      setTimeout(() => { concurrent--; r(); }, 10);
    });
    await Promise.all([bh.execute(task), bh.execute(task), bh.execute(task)]);
    assert.ok(maxConcurrent <= 2);
  });

  it('tracks counts', async () => {
    const bh = new Bulkhead(1);
    let resolve;
    const blocker = () => new Promise(r => { resolve = r; });
    const p = bh.execute(blocker);
    bh.execute(() => Promise.resolve());
    assert.equal(bh.activeCount, 1);
    assert.equal(bh.pendingCount, 1);
    resolve();
    await p;
  });
});
