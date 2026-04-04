import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from '../src/index.js';

let counter = 0;
const factory = () => ({ id: ++counter });

describe('Pool', () => {
  it('acquires object', async () => {
    const pool = new Pool(factory, { max: 5 });
    const obj = await pool.acquire();
    assert.ok(obj.id > 0);
    assert.equal(pool.inUse, 1);
  });

  it('releases back to pool', async () => {
    const pool = new Pool(factory, { max: 5 });
    const obj = await pool.acquire();
    pool.release(obj);
    assert.equal(pool.available, 1);
    assert.equal(pool.inUse, 0);
  });

  it('reuses released objects', async () => {
    const pool = new Pool(factory, { max: 5 });
    const obj1 = await pool.acquire();
    pool.release(obj1);
    const obj2 = await pool.acquire();
    assert.equal(obj1, obj2);
  });

  it('waits when at max', async () => {
    const pool = new Pool(factory, { max: 1 });
    const obj = await pool.acquire();
    assert.equal(pool.waiting, 0);
    
    const promise = pool.acquire();
    assert.equal(pool.waiting, 1);
    
    pool.release(obj);
    const obj2 = await promise;
    assert.equal(obj, obj2);
    assert.equal(pool.waiting, 0);
  });

  it('pre-creates min objects', () => {
    const pool = new Pool(factory, { min: 3, max: 10 });
    assert.equal(pool.available, 3);
  });

  it('stats', async () => {
    const pool = new Pool(factory, { max: 5 });
    await pool.acquire();
    await pool.acquire();
    assert.equal(pool.size, 2);
    assert.equal(pool.inUse, 2);
  });
});
