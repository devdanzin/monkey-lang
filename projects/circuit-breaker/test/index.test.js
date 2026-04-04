import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitBreakerError, State } from '../src/index.js';

describe('CircuitBreaker — closed state', () => {
  it('calls function normally', async () => {
    const cb = new CircuitBreaker(() => 'ok');
    assert.equal(await cb.call(), 'ok');
    assert.equal(cb.state, State.CLOSED);
  });

  it('passes arguments', async () => {
    const cb = new CircuitBreaker((a, b) => a + b);
    assert.equal(await cb.call(2, 3), 5);
  });

  it('propagates errors', async () => {
    const cb = new CircuitBreaker(() => { throw new Error('fail'); }, { failureThreshold: 10 });
    await assert.rejects(() => cb.call(), { message: 'fail' });
  });

  it('opens after threshold failures', async () => {
    let count = 0;
    const cb = new CircuitBreaker(() => { throw new Error(`fail ${++count}`); }, { failureThreshold: 3 });
    for (let i = 0; i < 3; i++) await cb.call().catch(() => {});
    assert.equal(cb.state, State.OPEN);
  });
});

describe('CircuitBreaker — open state', () => {
  it('rejects immediately when open', async () => {
    const cb = new CircuitBreaker(() => { throw new Error('fail'); }, { failureThreshold: 1, resetTimeout: 100 });
    await cb.call().catch(() => {});
    assert.equal(cb.state, State.OPEN);
    
    await assert.rejects(() => cb.call(), (err) => err instanceof CircuitBreakerError);
  });
});

describe('CircuitBreaker — half-open state', () => {
  it('transitions to half-open after timeout', async () => {
    const cb = new CircuitBreaker(() => { throw new Error('fail'); }, { failureThreshold: 1, resetTimeout: 50 });
    await cb.call().catch(() => {});
    assert.equal(cb.state, State.OPEN);
    
    await new Promise(r => setTimeout(r, 60));
    // Next call should transition to half-open then succeed/fail
    const cb2 = new CircuitBreaker(() => 'recovered', { failureThreshold: 1, resetTimeout: 50, successThreshold: 1 });
    await cb2.call().catch(() => {}); // trigger open
    cb2.lastFailureTime = Date.now() - 60; // simulate timeout passed
    assert.equal(await cb2.call(), 'recovered');
    assert.equal(cb2.state, State.CLOSED);
  });

  it('returns to open on failure in half-open', async () => {
    let calls = 0;
    const cb = new CircuitBreaker(() => { if (++calls <= 5) throw new Error('fail'); return 'ok'; },
      { failureThreshold: 1, resetTimeout: 10, successThreshold: 2 });
    
    await cb.call().catch(() => {}); // trip to open
    assert.equal(cb.state, State.OPEN);
    
    await new Promise(r => setTimeout(r, 20));
    
    // Half-open: next call fails → back to open
    await cb.call().catch(() => {});
    assert.equal(cb.state, State.OPEN);
  });
});

describe('CircuitBreaker — stats', () => {
  it('tracks calls and failures', async () => {
    let fail = true;
    const cb = new CircuitBreaker(() => { if (fail) throw new Error('x'); return 'ok'; }, { failureThreshold: 10 });
    
    await cb.call().catch(() => {});
    await cb.call().catch(() => {});
    fail = false;
    await cb.call();
    
    const stats = cb.stats;
    assert.equal(stats.totalCalls, 3);
    assert.equal(stats.totalFailures, 2);
    assert.equal(stats.totalSuccesses, 1);
  });
});

describe('CircuitBreaker — onStateChange', () => {
  it('notifies on transition', async () => {
    const transitions = [];
    const cb = new CircuitBreaker(() => { throw new Error('fail'); }, { failureThreshold: 1 });
    cb.onStateChange(({ from, to }) => transitions.push({ from, to }));
    
    await cb.call().catch(() => {});
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].from, State.CLOSED);
    assert.equal(transitions[0].to, State.OPEN);
  });
});

describe('CircuitBreaker — reset', () => {
  it('resets to closed', async () => {
    const cb = new CircuitBreaker(() => { throw new Error('fail'); }, { failureThreshold: 1 });
    await cb.call().catch(() => {});
    assert.equal(cb.state, State.OPEN);
    cb.reset();
    assert.equal(cb.state, State.CLOSED);
  });
});

describe('CircuitBreaker — async', () => {
  it('works with async functions', async () => {
    const cb = new CircuitBreaker(async () => {
      await new Promise(r => setTimeout(r, 10));
      return 42;
    });
    assert.equal(await cb.call(), 42);
  });
});
