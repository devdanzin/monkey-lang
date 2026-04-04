import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MyPromise, EventLoop } from './promise.js';

// Helper to wait for microtasks
const flush = () => new Promise(r => setTimeout(r, 10));

describe('MyPromise - Basic', () => {
  it('resolves with value', async () => {
    const p = new MyPromise(resolve => resolve(42));
    const val = await p.then(v => v);
    assert.equal(val, 42);
  });

  it('rejects with reason', async () => {
    const p = new MyPromise((_, reject) => reject('error'));
    const reason = await p.catch(r => r);
    assert.equal(reason, 'error');
  });

  it('catches thrown errors', async () => {
    const p = new MyPromise(() => { throw new Error('oops'); });
    const err = await p.catch(e => e.message);
    assert.equal(err, 'oops');
  });
});

describe('MyPromise - Chaining', () => {
  it('chains then calls', async () => {
    const result = await new MyPromise(resolve => resolve(1))
      .then(v => v + 1)
      .then(v => v * 3);
    assert.equal(result, 6);
  });

  it('chains with async resolution', async () => {
    const result = await new MyPromise(resolve => resolve(10))
      .then(v => new MyPromise(resolve => resolve(v + 5)))
      .then(v => v * 2);
    assert.equal(result, 30);
  });

  it('error propagation through chain', async () => {
    const result = await MyPromise.reject('fail')
      .then(v => v + 1) // skipped
      .then(v => v + 2) // skipped
      .catch(r => `caught: ${r}`);
    assert.equal(result, 'caught: fail');
  });

  it('recovery in chain', async () => {
    const result = await MyPromise.reject('fail')
      .catch(r => 'recovered')
      .then(v => v + '!');
    assert.equal(result, 'recovered!');
  });
});

describe('MyPromise - Finally', () => {
  it('runs on resolve', async () => {
    let ran = false;
    await new MyPromise(resolve => resolve(42))
      .finally(() => { ran = true; });
    assert.ok(ran);
  });

  it('runs on reject', async () => {
    let ran = false;
    await new MyPromise((_, reject) => reject('err'))
      .finally(() => { ran = true; })
      .catch(() => {});
    assert.ok(ran);
  });

  it('passes through value', async () => {
    const val = await MyPromise.resolve(42).finally(() => {});
    assert.equal(val, 42);
  });
});

describe('MyPromise.resolve/reject', () => {
  it('resolve wraps value', async () => {
    const val = await MyPromise.resolve(99);
    assert.equal(val, 99);
  });

  it('resolve with promise is identity', async () => {
    const p = MyPromise.resolve(42);
    const p2 = MyPromise.resolve(p);
    assert.equal(p, p2);
  });

  it('reject creates rejected promise', async () => {
    const r = await MyPromise.reject('nope').catch(e => e);
    assert.equal(r, 'nope');
  });
});

describe('MyPromise.all', () => {
  it('resolves all', async () => {
    const result = await MyPromise.all([
      MyPromise.resolve(1),
      MyPromise.resolve(2),
      MyPromise.resolve(3),
    ]);
    assert.deepStrictEqual(result, [1, 2, 3]);
  });

  it('rejects on first failure', async () => {
    const result = await MyPromise.all([
      MyPromise.resolve(1),
      MyPromise.reject('fail'),
      MyPromise.resolve(3),
    ]).catch(e => e);
    assert.equal(result, 'fail');
  });

  it('empty array resolves immediately', async () => {
    const result = await MyPromise.all([]);
    assert.deepStrictEqual(result, []);
  });

  it('preserves order', async () => {
    const result = await MyPromise.all([
      new MyPromise(resolve => setTimeout(() => resolve('slow'), 50)),
      MyPromise.resolve('fast'),
    ]);
    assert.deepStrictEqual(result, ['slow', 'fast']);
  });
});

describe('MyPromise.race', () => {
  it('resolves with first', async () => {
    const result = await MyPromise.race([
      new MyPromise(resolve => setTimeout(() => resolve('slow'), 100)),
      MyPromise.resolve('fast'),
    ]);
    assert.equal(result, 'fast');
  });

  it('rejects with first rejection', async () => {
    const result = await MyPromise.race([
      new MyPromise(resolve => setTimeout(() => resolve('slow'), 100)),
      MyPromise.reject('fail'),
    ]).catch(e => e);
    assert.equal(result, 'fail');
  });
});

describe('MyPromise.allSettled', () => {
  it('reports all results', async () => {
    const result = await MyPromise.allSettled([
      MyPromise.resolve(1),
      MyPromise.reject('fail'),
      MyPromise.resolve(3),
    ]);
    assert.equal(result.length, 3);
    assert.equal(result[0].status, 'fulfilled');
    assert.equal(result[0].value, 1);
    assert.equal(result[1].status, 'rejected');
    assert.equal(result[1].reason, 'fail');
    assert.equal(result[2].status, 'fulfilled');
  });
});

describe('MyPromise.any', () => {
  it('resolves with first success', async () => {
    const result = await MyPromise.any([
      MyPromise.reject('a'),
      MyPromise.resolve('b'),
      MyPromise.resolve('c'),
    ]);
    assert.equal(result, 'b');
  });

  it('rejects if all fail', async () => {
    try {
      await MyPromise.any([
        MyPromise.reject('a'),
        MyPromise.reject('b'),
      ]);
      assert.fail('should have thrown');
    } catch (e) {
      assert.ok(e instanceof AggregateError);
    }
  });
});

describe('MyPromise - Thenable interop', () => {
  it('resolves thenable', async () => {
    const thenable = { then(resolve) { resolve(42); } };
    const val = await new MyPromise(resolve => resolve(thenable));
    assert.equal(val, 42);
  });
});

describe('Deferred', () => {
  it('creates deferred', async () => {
    const d = MyPromise.deferred();
    d.resolve(42);
    const val = await d.promise;
    assert.equal(val, 42);
  });
});

describe('EventLoop', () => {
  it('processes setTimeout', () => {
    const loop = new EventLoop();
    let called = false;
    loop.setTimeout(() => { called = true; }, 100);
    loop.tick(50);
    assert.ok(!called);
    loop.tick(51);
    assert.ok(called);
  });

  it('processes setInterval', () => {
    const loop = new EventLoop();
    let count = 0;
    loop.setInterval(() => { count++; }, 100);
    loop.tick(100); assert.equal(count, 1);
    loop.tick(100); assert.equal(count, 2);
    loop.tick(100); assert.equal(count, 3);
  });

  it('clearTimeout', () => {
    const loop = new EventLoop();
    let called = false;
    const id = loop.setTimeout(() => { called = true; }, 100);
    loop.clearTimeout(id);
    loop.tick(200);
    assert.ok(!called);
  });

  it('microtasks run before next macro', () => {
    const loop = new EventLoop();
    const order = [];
    loop.macroQueue.push(() => {
      order.push('macro1');
      loop.queueMicrotask(() => order.push('micro1'));
      loop.queueMicrotask(() => order.push('micro2'));
    });
    loop.macroQueue.push(() => order.push('macro2'));
    loop.tick(0);
    assert.deepStrictEqual(order, ['macro1', 'micro1', 'micro2']);
    loop.tick(0);
    assert.deepStrictEqual(order, ['macro1', 'micro1', 'micro2', 'macro2']);
  });
});
