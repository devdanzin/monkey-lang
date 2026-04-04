import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MyPromise } from '../src/index.js';

describe('MyPromise — basic', () => {
  it('resolves with a value', async () => {
    const p = new MyPromise((resolve) => resolve(42));
    const v = await p.then(v => v);
    assert.equal(v, 42);
  });

  it('rejects with a reason', async () => {
    const p = new MyPromise((_, reject) => reject('error'));
    const v = await p.catch(e => e);
    assert.equal(v, 'error');
  });

  it('async resolve', async () => {
    const p = new MyPromise((resolve) => setTimeout(() => resolve('async'), 10));
    const v = await p.then(v => v);
    assert.equal(v, 'async');
  });

  it('executor error becomes rejection', async () => {
    const p = new MyPromise(() => { throw new Error('boom'); });
    const e = await p.catch(e => e);
    assert.equal(e.message, 'boom');
  });
});

describe('MyPromise — then chaining', () => {
  it('chains then calls', async () => {
    const v = await new MyPromise((r) => r(1))
      .then(v => v + 1)
      .then(v => v * 2);
    assert.equal(v, 4);
  });

  it('then returns new promise', () => {
    const p1 = new MyPromise((r) => r(1));
    const p2 = p1.then(v => v);
    assert.notEqual(p1, p2);
  });

  it('passes through on missing handler', async () => {
    const v = await new MyPromise((r) => r(42)).then(null).then(v => v);
    assert.equal(v, 42);
  });

  it('chains with thenable return', async () => {
    const v = await new MyPromise((r) => r(1))
      .then(v => new MyPromise((r) => r(v + 10)));
    assert.equal(v, 11);
  });
});

describe('MyPromise — catch', () => {
  it('catches rejection', async () => {
    const v = await MyPromise.reject('err').catch(e => 'caught: ' + e);
    assert.equal(v, 'caught: err');
  });

  it('propagates through then', async () => {
    const v = await MyPromise.reject('err')
      .then(v => v * 2) // skipped
      .catch(e => 'caught');
    assert.equal(v, 'caught');
  });

  it('catch returns fulfilled promise', async () => {
    const v = await MyPromise.reject('err')
      .catch(e => 42)
      .then(v => v + 1);
    assert.equal(v, 43);
  });
});

describe('MyPromise — finally', () => {
  it('runs on fulfill', async () => {
    let ran = false;
    await MyPromise.resolve(42).finally(() => { ran = true; });
    assert.equal(ran, true);
  });

  it('runs on reject', async () => {
    let ran = false;
    await MyPromise.reject('err').finally(() => { ran = true; }).catch(() => {});
    assert.equal(ran, true);
  });

  it('passes through value', async () => {
    const v = await MyPromise.resolve(42).finally(() => {});
    assert.equal(v, 42);
  });

  it('passes through rejection', async () => {
    const v = await MyPromise.reject('err').finally(() => {}).catch(e => e);
    assert.equal(v, 'err');
  });
});

describe('MyPromise.resolve/reject', () => {
  it('resolve wraps value', async () => {
    assert.equal(await MyPromise.resolve(42).then(v => v), 42);
  });

  it('resolve returns same promise', () => {
    const p = new MyPromise((r) => r(1));
    assert.equal(MyPromise.resolve(p), p);
  });

  it('reject wraps reason', async () => {
    assert.equal(await MyPromise.reject('e').catch(e => e), 'e');
  });
});

describe('MyPromise.all', () => {
  it('resolves all', async () => {
    const result = await MyPromise.all([
      MyPromise.resolve(1),
      MyPromise.resolve(2),
      MyPromise.resolve(3),
    ]);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('rejects on first failure', async () => {
    const r = await MyPromise.all([
      MyPromise.resolve(1),
      MyPromise.reject('fail'),
      MyPromise.resolve(3),
    ]).catch(e => e);
    assert.equal(r, 'fail');
  });

  it('empty array resolves immediately', async () => {
    const r = await MyPromise.all([]);
    assert.deepEqual(r, []);
  });

  it('preserves order', async () => {
    const r = await MyPromise.all([
      MyPromise.delay(20, 'slow'),
      MyPromise.delay(5, 'fast'),
    ]);
    assert.deepEqual(r, ['slow', 'fast']);
  });
});

describe('MyPromise.race', () => {
  it('resolves with first', async () => {
    const r = await MyPromise.race([
      MyPromise.delay(20, 'slow'),
      MyPromise.delay(5, 'fast'),
    ]);
    assert.equal(r, 'fast');
  });
});

describe('MyPromise.allSettled', () => {
  it('returns all results', async () => {
    const r = await MyPromise.allSettled([
      MyPromise.resolve(1),
      MyPromise.reject('err'),
      MyPromise.resolve(3),
    ]);
    assert.equal(r[0].status, 'fulfilled');
    assert.equal(r[0].value, 1);
    assert.equal(r[1].status, 'rejected');
    assert.equal(r[1].reason, 'err');
  });
});

describe('MyPromise.any', () => {
  it('resolves with first success', async () => {
    const r = await MyPromise.any([
      MyPromise.reject('a'),
      MyPromise.resolve('b'),
      MyPromise.resolve('c'),
    ]);
    assert.equal(r, 'b');
  });

  it('rejects when all fail', async () => {
    const e = await MyPromise.any([
      MyPromise.reject('a'),
      MyPromise.reject('b'),
    ]).catch(e => e);
    assert.ok(e instanceof AggregateError);
  });
});

describe('MyPromise — utilities', () => {
  it('delay resolves after timeout', async () => {
    const start = Date.now();
    await MyPromise.delay(50);
    assert.ok(Date.now() - start >= 40); // allow some tolerance
  });

  it('fromCallback converts node-style callback', async () => {
    const v = await MyPromise.fromCallback((cb) => cb(null, 42));
    assert.equal(v, 42);
  });

  it('fromCallback converts error', async () => {
    const e = await MyPromise.fromCallback((cb) => cb(new Error('oops'))).catch(e => e);
    assert.equal(e.message, 'oops');
  });
});
