import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Semaphore, Mutex, ReadWriteLock, Barrier } from '../src/index.js';

describe('Semaphore', () => {
  it('basic acquire/release', async () => {
    const s = new Semaphore(2);
    await s.acquire();
    assert.equal(s.available, 1);
    await s.acquire();
    assert.equal(s.available, 0);
    s.release();
    assert.equal(s.available, 1);
  });

  it('queues when exhausted', async () => {
    const s = new Semaphore(1);
    await s.acquire();
    let resolved = false;
    const p = s.acquire().then(() => { resolved = true; });
    assert.equal(s.waiting, 1);
    s.release();
    await p;
    assert.equal(resolved, true);
  });

  it('use() auto-releases', async () => {
    const s = new Semaphore(1);
    const result = await s.use(() => 42);
    assert.equal(result, 42);
    assert.equal(s.available, 1);
  });

  it('use() releases on error', async () => {
    const s = new Semaphore(1);
    try { await s.use(() => { throw new Error('fail'); }); } catch {}
    assert.equal(s.available, 1);
  });
});

describe('Mutex', () => {
  it('mutual exclusion', async () => {
    const m = new Mutex();
    const order = [];
    const t1 = m.withLock(async () => { order.push('a-start'); await delay(10); order.push('a-end'); });
    const t2 = m.withLock(async () => { order.push('b-start'); order.push('b-end'); });
    await Promise.all([t1, t2]);
    assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end']);
  });
});

describe('ReadWriteLock', () => {
  it('multiple readers', async () => {
    const rw = new ReadWriteLock();
    await rw.readLock();
    await rw.readLock();
    rw.readUnlock();
    rw.readUnlock();
  });

  it('writer blocks readers', async () => {
    const rw = new ReadWriteLock();
    await rw.writeLock();
    let read = false;
    const p = rw.readLock().then(() => { read = true; });
    assert.equal(read, false);
    rw.writeUnlock();
    await p;
    assert.equal(read, true);
    rw.readUnlock();
  });
});

describe('Barrier', () => {
  it('releases all parties', async () => {
    const b = new Barrier(3);
    const results = [];
    const p1 = b.arrive().then(() => results.push(1));
    const p2 = b.arrive().then(() => results.push(2));
    const p3 = b.arrive().then(() => results.push(3));
    await Promise.all([p1, p2, p3]);
    assert.equal(results.length, 3);
  });
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
