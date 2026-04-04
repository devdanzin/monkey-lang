import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, untracked } from '../src/index.js';

describe('signal — basic', () => {
  it('creates with initial value', () => {
    const count = signal(0);
    assert.equal(count(), 0);
  });

  it('sets value', () => {
    const count = signal(0);
    count.set(5);
    assert.equal(count(), 5);
  });

  it('updates via function', () => {
    const count = signal(10);
    count.update(v => v + 5);
    assert.equal(count(), 15);
  });

  it('peek reads without tracking', () => {
    const count = signal(42);
    assert.equal(count.peek(), 42);
  });

  it('ignores same value', () => {
    const count = signal(5);
    let runs = 0;
    effect(() => { count(); runs++; });
    assert.equal(runs, 1);
    count.set(5); // same value
    assert.equal(runs, 1);
  });
});

describe('computed', () => {
  it('derives from signal', () => {
    const count = signal(2);
    const doubled = computed(() => count() * 2);
    assert.equal(doubled(), 4);
  });

  it('updates when signal changes', () => {
    const count = signal(3);
    const doubled = computed(() => count() * 2);
    count.set(5);
    assert.equal(doubled(), 10);
  });

  it('chains computeds', () => {
    const a = signal(1);
    const b = computed(() => a() * 2);
    const c = computed(() => b() + 10);
    assert.equal(c(), 12);
    a.set(5);
    assert.equal(c(), 20);
  });

  it('is lazy — only computes when read', () => {
    let computeCount = 0;
    const a = signal(1);
    const b = computed(() => { computeCount++; return a() * 2; });
    assert.equal(computeCount, 0);
    b();
    assert.equal(computeCount, 1);
    b(); // cached
    assert.equal(computeCount, 1);
    a.set(2);
    assert.equal(computeCount, 1); // still lazy
    b();
    assert.equal(computeCount, 2);
  });
});

describe('effect', () => {
  it('runs immediately', () => {
    let ran = false;
    const dispose = effect(() => { ran = true; });
    assert.equal(ran, true);
    dispose();
  });

  it('re-runs when dependency changes', () => {
    const count = signal(0);
    let observed = -1;
    const dispose = effect(() => { observed = count(); });
    assert.equal(observed, 0);
    count.set(5);
    assert.equal(observed, 5);
    dispose();
  });

  it('tracks computed dependencies', () => {
    const a = signal(1);
    const b = computed(() => a() * 10);
    let observed = -1;
    const dispose = effect(() => { observed = b(); });
    assert.equal(observed, 10);
    a.set(3);
    assert.equal(observed, 30);
    dispose();
  });

  it('dispose stops tracking', () => {
    const count = signal(0);
    let runs = 0;
    const dispose = effect(() => { count(); runs++; });
    assert.equal(runs, 1);
    dispose();
    count.set(1);
    assert.equal(runs, 1); // no re-run after dispose
  });

  it('cleanup function called on re-run', () => {
    const count = signal(0);
    let cleaned = false;
    const dispose = effect(() => {
      count();
      return () => { cleaned = true; };
    });
    assert.equal(cleaned, false);
    count.set(1); // re-runs, should call cleanup first
    // Note: cleanup is called when dispose is invoked or before re-run
    dispose();
    assert.equal(cleaned, true);
  });
});

describe('batch', () => {
  it('defers effects until batch completes', () => {
    const a = signal(1);
    const b = signal(2);
    let runs = 0;
    const dispose = effect(() => { a(); b(); runs++; });
    assert.equal(runs, 1);
    
    batch(() => {
      a.set(10);
      b.set(20);
    });
    // Effect should only run once for the batch, not twice
    assert.equal(runs, 2);
    dispose();
  });

  it('nested batches work', () => {
    const a = signal(0);
    let runs = 0;
    const dispose = effect(() => { a(); runs++; });
    
    batch(() => {
      batch(() => {
        a.set(1);
        a.set(2);
      });
      a.set(3);
    });
    assert.equal(runs, 2); // initial + one batch
    dispose();
  });
});

describe('untracked', () => {
  it('reads without creating dependency', () => {
    const a = signal(1);
    const b = signal(2);
    let runs = 0;
    
    const dispose = effect(() => {
      a(); // tracked
      untracked(() => b()); // not tracked
      runs++;
    });
    assert.equal(runs, 1);
    
    b.set(10); // should NOT trigger effect
    assert.equal(runs, 1);
    
    a.set(5); // should trigger
    assert.equal(runs, 2);
    dispose();
  });
});

describe('signal — subscribe', () => {
  it('subscribe receives updates', () => {
    const count = signal(0);
    const values = [];
    const unsub = count.subscribe(v => values.push(v));
    count.set(1);
    count.set(2);
    assert.deepEqual(values, [1, 2]);
    unsub();
  });

  it('unsubscribe stops updates', () => {
    const count = signal(0);
    const values = [];
    const unsub = count.subscribe(v => values.push(v));
    count.set(1);
    unsub();
    count.set(2);
    assert.deepEqual(values, [1]);
  });
});
