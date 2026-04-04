import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Scheduler, MinHeap } from '../src/index.js';

describe('MinHeap', () => {
  it('maintains min order', () => {
    const h = new MinHeap();
    h.push({ priority: 3 }); h.push({ priority: 1 }); h.push({ priority: 2 });
    assert.equal(h.pop().priority, 1);
    assert.equal(h.pop().priority, 2);
    assert.equal(h.pop().priority, 3);
  });

  it('peek returns min without removing', () => {
    const h = new MinHeap();
    h.push({ priority: 5 }); h.push({ priority: 2 });
    assert.equal(h.peek().priority, 2);
    assert.equal(h.size, 2);
  });
});

describe('Scheduler — basic', () => {
  it('schedules and runs task', () => {
    const s = new Scheduler();
    let ran = false;
    s.schedule(() => { ran = true; });
    s.tick();
    assert.equal(ran, true);
  });

  it('passes back result', () => {
    const s = new Scheduler();
    const id = s.schedule(() => 42);
    s.tick();
    assert.equal(s.getTask(id).lastResult, 42);
  });

  it('runs multiple tasks in priority order', () => {
    const s = new Scheduler();
    const log = [];
    const now = Date.now();
    s.schedule(() => log.push('low'), { priority: 10 });
    s.schedule(() => log.push('high'), { priority: 1 });
    s.tick(now);
    assert.deepEqual(log, ['high', 'low']);
  });
});

describe('Scheduler — delayed', () => {
  it('does not run before delay', () => {
    const s = new Scheduler();
    let ran = false;
    s.schedule(() => { ran = true; }, { delay: 1000 });
    s.tick();
    assert.equal(ran, false);
  });

  it('runs after delay', () => {
    const s = new Scheduler();
    let ran = false;
    const now = Date.now();
    s.schedule(() => { ran = true; }, { delay: 100 });
    s.tick(now); // too early
    assert.equal(ran, false);
    s.tick(now + 100); // now it's time
    assert.equal(ran, true);
  });
});

describe('Scheduler — recurring', () => {
  it('runs multiple times', () => {
    const s = new Scheduler();
    let count = 0;
    const now = Date.now();
    s.scheduleRecurring(() => count++, { interval: 100 });
    s.tick(now);       // run 1
    s.tick(now + 100);  // run 2
    s.tick(now + 200);  // run 3
    assert.equal(count, 3);
  });

  it('respects maxRuns', () => {
    const s = new Scheduler();
    let count = 0;
    const now = Date.now();
    s.scheduleRecurring(() => count++, { interval: 100, maxRuns: 2 });
    s.tick(now); s.tick(now + 100); s.tick(now + 200);
    assert.equal(count, 2);
  });
});

describe('Scheduler — cancel', () => {
  it('cancels pending task', () => {
    const s = new Scheduler();
    let ran = false;
    const id = s.schedule(() => { ran = true; }, { delay: 100 });
    s.cancel(id);
    s.tick(Date.now() + 200);
    assert.equal(ran, false);
  });

  it('cancels recurring task', () => {
    const s = new Scheduler();
    let count = 0;
    const now = Date.now();
    const id = s.scheduleRecurring(() => count++, { interval: 100 });
    s.tick(now); // run once
    s.cancel(id);
    s.tick(now + 100); // should not run
    assert.equal(count, 1);
  });
});

describe('Scheduler — error handling', () => {
  it('captures errors without stopping', () => {
    const s = new Scheduler();
    const log = [];
    s.schedule(() => { throw new Error('oops'); });
    s.schedule(() => log.push('ok'));
    s.tick();
    assert.deepEqual(log, ['ok']);
  });

  it('stores error on task', () => {
    const s = new Scheduler();
    const id = s.schedule(() => { throw new Error('fail'); });
    s.tick();
    assert.equal(s.getTask(id).lastError.message, 'fail');
  });
});

describe('Scheduler — scheduleAt', () => {
  it('runs at specific time', () => {
    const s = new Scheduler();
    let ran = false;
    const future = Date.now() + 500;
    s.scheduleAt(() => { ran = true; }, future);
    s.tick(future - 1); // not yet
    assert.equal(ran, false);
    s.tick(future); // now
    assert.equal(ran, true);
  });
});
