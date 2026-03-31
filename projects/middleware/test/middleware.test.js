import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pipeline, compose } from '../src/index.js';

describe('Pipeline', () => {
  it('executes in order', async () => {
    const order = [];
    const p = new Pipeline();
    p.use(async (ctx, next) => { order.push('a'); await next(); order.push('a2'); });
    p.use(async (ctx, next) => { order.push('b'); await next(); order.push('b2'); });
    await p.execute();
    assert.deepEqual(order, ['a', 'b', 'b2', 'a2']); // Onion model
  });

  it('modifies context', async () => {
    const p = new Pipeline();
    p.use(async (ctx, next) => { ctx.x = 1; await next(); });
    p.use(async (ctx, next) => { ctx.y = 2; await next(); });
    const ctx = await p.execute();
    assert.equal(ctx.x, 1);
    assert.equal(ctx.y, 2);
  });

  it('stops without next()', async () => {
    const order = [];
    const p = new Pipeline();
    p.use(async (ctx) => { order.push('a'); }); // No next()
    p.use(async (ctx) => { order.push('b'); });
    await p.execute();
    assert.deepEqual(order, ['a']);
  });
});

describe('compose', () => {
  it('composes functions', async () => {
    const order = [];
    const fn = compose(
      async (ctx, next) => { order.push(1); await next(); order.push(4); },
      async (ctx, next) => { order.push(2); await next(); order.push(3); },
    );
    await fn({}, () => {});
    assert.deepEqual(order, [1, 2, 3, 4]);
  });
});

describe('error handling', () => {
  it('catches errors', async () => {
    const p = new Pipeline();
    p.use(async (ctx, next) => { try { await next(); } catch (e) { ctx.error = e.message; } });
    p.use(async () => { throw new Error('boom'); });
    const ctx = await p.execute();
    assert.equal(ctx.error, 'boom');
  });
});
