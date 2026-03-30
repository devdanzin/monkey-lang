import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MyPromise } from '../src/index.js';

function delay(ms, value) {
  return new MyPromise(resolve => setTimeout(() => resolve(value), ms));
}

describe('Basic resolution', () => {
  it('resolves with value', async () => {
    const result = await new MyPromise(resolve => resolve(42));
    assert.equal(result, 42);
  });

  it('rejects with reason', async () => {
    try {
      await new MyPromise((_, reject) => reject(new Error('fail')));
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.message, 'fail');
    }
  });

  it('catches executor errors', async () => {
    try {
      await new MyPromise(() => { throw new Error('oops'); });
      assert.fail();
    } catch (err) {
      assert.equal(err.message, 'oops');
    }
  });
});

describe('then chaining', () => {
  it('chains .then()', async () => {
    const result = await MyPromise.resolve(1)
      .then(v => v + 1)
      .then(v => v * 3);
    assert.equal(result, 6);
  });

  it('passes through on missing handler', async () => {
    const result = await MyPromise.resolve(42).then().then(v => v);
    assert.equal(result, 42);
  });

  it('propagates rejection through .then()', async () => {
    try {
      await MyPromise.reject('err').then(v => v + 1);
      assert.fail();
    } catch (err) {
      assert.equal(err, 'err');
    }
  });

  it('recovers from rejection in .catch()', async () => {
    const result = await MyPromise.reject('err').catch(e => 'recovered');
    assert.equal(result, 'recovered');
  });
});

describe('then with thenables', () => {
  it('resolves thenables', async () => {
    const result = await new MyPromise(resolve => {
      resolve({ then(onFulfilled) { onFulfilled(99); } });
    });
    assert.equal(result, 99);
  });

  it('chains returned promises', async () => {
    const result = await MyPromise.resolve(1)
      .then(v => new MyPromise(resolve => setTimeout(() => resolve(v + 10), 1)));
    assert.equal(result, 11);
  });
});

describe('finally', () => {
  it('runs on resolve', async () => {
    let ran = false;
    const result = await MyPromise.resolve(5).finally(() => { ran = true; });
    assert.equal(result, 5);
    assert.equal(ran, true);
  });

  it('runs on reject', async () => {
    let ran = false;
    try {
      await MyPromise.reject('e').finally(() => { ran = true; });
    } catch {}
    assert.equal(ran, true);
  });
});

describe('static methods', () => {
  it('resolve', async () => {
    assert.equal(await MyPromise.resolve(42), 42);
  });

  it('reject', async () => {
    try { await MyPromise.reject('x'); assert.fail(); }
    catch (e) { assert.equal(e, 'x'); }
  });

  it('all — all resolve', async () => {
    const result = await MyPromise.all([
      MyPromise.resolve(1),
      MyPromise.resolve(2),
      MyPromise.resolve(3),
    ]);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('all — one rejects', async () => {
    try {
      await MyPromise.all([MyPromise.resolve(1), MyPromise.reject('fail')]);
      assert.fail();
    } catch (e) {
      assert.equal(e, 'fail');
    }
  });

  it('all — empty', async () => {
    assert.deepEqual(await MyPromise.all([]), []);
  });

  it('race', async () => {
    const result = await MyPromise.race([
      delay(50, 'slow'),
      delay(1, 'fast'),
    ]);
    assert.equal(result, 'fast');
  });

  it('allSettled', async () => {
    const results = await MyPromise.allSettled([
      MyPromise.resolve(1),
      MyPromise.reject('err'),
    ]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[0].value, 1);
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason, 'err');
  });

  it('any — first resolve wins', async () => {
    const result = await MyPromise.any([
      MyPromise.reject('a'),
      MyPromise.resolve(42),
      MyPromise.reject('c'),
    ]);
    assert.equal(result, 42);
  });
});

describe('async behavior', () => {
  it('callbacks are asynchronous', async () => {
    let order = [];
    const p = MyPromise.resolve(1).then(v => { order.push('then'); return v; });
    order.push('sync');
    await p;
    assert.deepEqual(order, ['sync', 'then']);
  });
});
