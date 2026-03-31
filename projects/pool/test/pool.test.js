import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from '../src/index.js';

let nextId = 0;
const factory = () => ({ id: nextId++, alive: true });

describe('Basic', () => {
  it('acquire and release', async () => {
    const pool = new Pool(factory, { max: 3 });
    const item = await pool.acquire();
    assert.ok(item.id >= 0);
    assert.equal(pool.inUse, 1);
    pool.release(item);
    assert.equal(pool.available, 1);
    assert.equal(pool.inUse, 0);
  });

  it('reuses released items', async () => {
    const pool = new Pool(factory, { max: 2 });
    const a = await pool.acquire();
    pool.release(a);
    const b = await pool.acquire();
    assert.equal(a.id, b.id);
  });

  it('respects max size', async () => {
    const pool = new Pool(factory, { max: 2, acquireTimeout: 100 });
    await pool.acquire();
    await pool.acquire();
    try { await pool.acquire(); assert.fail(); }
    catch (e) { assert.equal(e.message, 'Acquire timeout'); }
  });
});

describe('Waiting', () => {
  it('queues when full', async () => {
    const pool = new Pool(factory, { max: 1 });
    const a = await pool.acquire();
    const promise = pool.acquire();
    assert.equal(pool.waiting, 1);
    pool.release(a);
    const b = await promise;
    assert.ok(b);
  });
});

describe('Stats', () => {
  it('reports stats', async () => {
    const pool = new Pool(factory, { max: 5 });
    await pool.acquire();
    await pool.acquire();
    const s = pool.stats();
    assert.equal(s.size, 2);
    assert.equal(s.inUse, 2);
    assert.equal(s.available, 0);
  });
});
